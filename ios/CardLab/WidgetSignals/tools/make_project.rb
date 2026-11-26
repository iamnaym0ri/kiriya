# Generates the lab's own Xcode project (.build/SignalsLab.xcodeproj; never App.xcodeproj): a host app and
# a widget extension, so xcodebuild runs the App Intents metadata step that interactive, configurable
# widgets need (plain swiftc can't). Simulator only.
#   ruby tools/make_project.rb
require "xcodeproj"
require "fileutils"

HERE = File.expand_path("..", __dir__)
SIGNALS = File.expand_path("../../App/KiriyaWidgets/Signals", HERE)
SHARED = File.expand_path("../../App/KiriyaShared", HERE)
BUILD = File.join(HERE, ".build")
FileUtils.mkdir_p(BUILD)
path = File.join(BUILD, "SignalsLab.xcodeproj")
FileUtils.rm_rf(path)
project = Xcodeproj::Project.new(path)

def settings(target, bundle_id, info: nil)
  target.build_configurations.each do |config|
    s = config.build_settings
    s["PRODUCT_BUNDLE_IDENTIFIER"] = bundle_id
    s["IPHONEOS_DEPLOYMENT_TARGET"] = "17.0"
    s["SWIFT_VERSION"] = "5.0"
    s["TARGETED_DEVICE_FAMILY"] = "1"
    s["SWIFT_ACTIVE_COMPILATION_CONDITIONS"] = "DEBUG SIGNALS_LAB"
    s["CODE_SIGN_IDENTITY"] = "-"
    s["CODE_SIGN_STYLE"] = "Manual"
    s["DEVELOPMENT_TEAM"] = ""
    s["MARKETING_VERSION"] = "1.0"
    s["CURRENT_PROJECT_VERSION"] = "1"
    s["SDKROOT"] = "iphonesimulator"
    # One module name for both, so the App Intents metadata in either bundle maps to the same Swift types
    # (in the real app the Signals intents live in the widget extension only).
    s["PRODUCT_MODULE_NAME"] = "SignalsLabWidget"
    s["SUPPORTED_PLATFORMS"] = "iphonesimulator"
    if info
      s["INFOPLIST_FILE"] = info
      s["GENERATE_INFOPLIST_FILE"] = "NO"
    else
      s["GENERATE_INFOPLIST_FILE"] = "YES"
      s["INFOPLIST_KEY_UILaunchScreen_Generation"] = "YES"
      s["INFOPLIST_KEY_CFBundleDisplayName"] = "Signals Lab"
    end
  end
end

group = project.main_group
refs = ->(dir, pattern) { Dir[File.join(dir, pattern)].sort.map { |f| group.new_reference(f) } }
signals = refs.(SIGNALS, "*.swift")
shared = refs.(SHARED, "*.swift")
fonts = refs.(File.join(SIGNALS, "Fonts"), "*.{ttf,txt}")

app = project.new_target(:application, "SignalsLab", :ios, "17.0")
settings(app, "love.kiriya.signalslab")
# Same module name as the extension, so the app builds into its own folder (two swiftmodules otherwise collide).
app.build_configurations.each { |c| c.build_settings["CONFIGURATION_BUILD_DIR"] = "$(BUILD_DIR)/app-$(CONFIGURATION)$(EFFECTIVE_PLATFORM_NAME)" }
app_sources = signals + shared + [group.new_reference(File.join(HERE, "Lab/LabCore.swift")), group.new_reference(File.join(HERE, "Lab/sim/SignalsLabApp.swift"))]
app.add_file_references(app_sources)
fonts.each { |f| app.resources_build_phase.add_file_reference(f, true) }

# The widget extension's Info.plist
info = File.join(BUILD, "SignalsLabWidget-Info.plist")
File.write(info, <<~PLIST)
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0"><dict>
    <key>CFBundleDevelopmentRegion</key><string>en</string>
    <key>CFBundleDisplayName</key><string>Signals Lab</string>
    <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key><string>XPC!</string>
    <key>CFBundleShortVersionString</key><string>1.0</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>UIAppFonts</key><array>
      <string>SignalsWidget-Gaegu-Bold.ttf</string>
      <string>SignalsWidget-Parisienne-Regular.ttf</string>
    </array>
    <key>NSExtension</key><dict>
      <key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string>
    </dict>
  </dict></plist>
PLIST
ext = project.new_target(:app_extension, "SignalsLabWidget", :ios, "17.0")
settings(ext, "love.kiriya.signalslab.widget", info: info)
ext.build_configurations.each { |c| c.build_settings["APPLICATION_EXTENSION_API_ONLY"] = "YES"; c.build_settings["SKIP_INSTALL"] = "YES" }
ext_sources = signals + shared + [group.new_reference(File.join(HERE, "Lab/LabCore.swift")), group.new_reference(File.join(HERE, "Lab/widget/SignalsLabWidget.swift"))]
ext.add_file_references(ext_sources)
fonts.each { |f| ext.resources_build_phase.add_file_reference(f, true) }
# Lab only: the simulator runtime's colour emoji font, copied into the extension (its sandbox can't read the
# runtime's copy), so Home Screen screenshots show real emoji instead of boxes.
emoji = "/System/Library/Fonts/Apple Color Emoji.ttc" # the Mac's copy, same Apple emoji (the runtime volume can be very slow to read)
if File.exist?(emoji)
  local = File.join(BUILD, "LabEmoji.ttc")
  FileUtils.cp(emoji, local) unless File.exist?(local)
  ext.resources_build_phase.add_file_reference(group.new_reference(local), true)
end

app.add_dependency(ext)
embed = app.new_copy_files_build_phase("Embed Foundation Extensions")
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(ext.product_reference, true)
bf.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }

project.save
puts "wrote #{path}"
