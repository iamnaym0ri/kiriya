# Generates the lab's own Xcode project (never App.xcodeproj) in .build/sim/:
#   NotesWidgetLab          a tiny app (Lab/sim/NotesWidgetLabApp.swift) that sets the widget's state
#   NotesWidgetLabWidgets   the widget extension: ios/App/KiriyaWidgets/Notes + KiriyaShared + Fonts
#   NotesWidgetLabService   a notification service extension that calls NotesWidgetMailbox.receive
# Signed to run locally on the simulator only. Usage: ruby tools/make-sim-project.rb
require "xcodeproj"
require "fileutils"

HERE = File.expand_path("..", __dir__)
NOTES = File.expand_path("../../App/KiriyaWidgets/Notes", HERE)
SHARED = File.expand_path("../../App/KiriyaShared", HERE)
OUT = File.join(HERE, ".build", "sim")
FileUtils.mkdir_p(OUT)
GROUP = "group.love.kiriya.app"

def plist(path, hash)
  Xcodeproj::Plist.write_to_path(hash, path)
end

base = { "CFBundleDevelopmentRegion" => "en", "CFBundleExecutable" => "$(EXECUTABLE_NAME)",
         "CFBundleIdentifier" => "$(PRODUCT_BUNDLE_IDENTIFIER)", "CFBundleInfoDictionaryVersion" => "6.0",
         "CFBundleName" => "$(PRODUCT_NAME)", "CFBundleShortVersionString" => "1.0", "CFBundleVersion" => "1" }
plist(File.join(OUT, "App-Info.plist"), base.merge(
  "CFBundlePackageType" => "APPL", "CFBundleDisplayName" => "Notes Lab", "UILaunchScreen" => {},
  "UISupportedInterfaceOrientations" => ["UIInterfaceOrientationPortrait"],
  "CFBundleURLTypes" => [{ "CFBundleURLName" => "kiriyalove", "CFBundleURLSchemes" => ["kiriyalove"] }]))
plist(File.join(OUT, "Widgets-Info.plist"), base.merge(
  "CFBundlePackageType" => "XPC!", "CFBundleDisplayName" => "kiriya.love",
  "NSExtension" => { "NSExtensionPointIdentifier" => "com.apple.widgetkit-extension" }))
plist(File.join(OUT, "Service-Info.plist"), base.merge(
  "CFBundlePackageType" => "XPC!", "CFBundleDisplayName" => "Notes Lab service",
  "NSExtension" => { "NSExtensionPointIdentifier" => "com.apple.usernotifications.service",
                     "NSExtensionPrincipalClass" => "$(PRODUCT_MODULE_NAME).NotificationService" }))
ents = { "com.apple.security.application-groups" => [GROUP] }
plist(File.join(OUT, "App.entitlements"), ents.merge("aps-environment" => "development"))
plist(File.join(OUT, "Ext.entitlements"), ents)

path = File.join(OUT, "NotesWidgetLab.xcodeproj")
FileUtils.rm_rf(path)
project = Xcodeproj::Project.new(path)

def target(project, type, name, bundle, plist, ents)
  t = project.new_target(type, name, :ios, "17.0", nil, :swift)
  t.build_configurations.each do |c|
    s = c.build_settings
    s["PRODUCT_NAME"] = name
    s["PRODUCT_BUNDLE_IDENTIFIER"] = bundle
    s["INFOPLIST_FILE"] = plist
    s["GENERATE_INFOPLIST_FILE"] = "NO"
    s["CODE_SIGN_ENTITLEMENTS"] = ents
    s["CODE_SIGN_IDENTITY"] = "-"
    s["CODE_SIGN_STYLE"] = "Manual"
    s["DEVELOPMENT_TEAM"] = ""
    s["SWIFT_VERSION"] = "5.0"
    s["IPHONEOS_DEPLOYMENT_TARGET"] = "17.0"
    s["TARGETED_DEVICE_FAMILY"] = "1"
    s["SWIFT_ACTIVE_COMPILATION_CONDITIONS"] = c.name == "Debug" ? "DEBUG" : ""
    if type == :app_extension
      s["SKIP_INSTALL"] = "YES"
      s["APPLICATION_EXTENSION_API_ONLY"] = "YES"
      s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"]
    else
      s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks"]
    end
  end
  t
end

app = target(project, :application, "NotesWidgetLab", "love.kiriya.noteswidgetlab", "App-Info.plist", "App.entitlements")
ext = target(project, :app_extension, "NotesWidgetLabWidgets", "love.kiriya.noteswidgetlab.widgets", "Widgets-Info.plist", "Ext.entitlements")
svc = target(project, :app_extension, "NotesWidgetLabService", "love.kiriya.noteswidgetlab.service", "Service-Info.plist", "Ext.entitlements")

group = project.main_group
ref = ->(p) { group.files.find { |f| f.path == p } || group.new_reference(p, :absolute) }

notes_swift = Dir[File.join(NOTES, "*.swift")].sort
fonts = Dir[File.join(NOTES, "Fonts", "*")].sort
ext.add_file_references((notes_swift + [File.join(SHARED, "KiriyaShared.swift"), File.join(SHARED, "KiriyaIntents.swift"),
                                         File.join(HERE, "Lab/sim/NotesWidgetLabBundle.swift")]).map(&ref))
fonts.each { |f| ext.resources_build_phase.add_file_reference(ref.(f), true) }
app.add_file_references([File.join(HERE, "Lab/sim/NotesWidgetLabApp.swift"), File.join(NOTES, "NotesWidgetMailbox.swift"),
                         File.join(SHARED, "KiriyaShared.swift")].map(&ref))
svc.add_file_references([File.join(HERE, "Lab/sim/NotesWidgetLabService.swift"), File.join(NOTES, "NotesWidgetMailbox.swift")].map(&ref))

embed = app.new_copy_files_build_phase("Embed Foundation Extensions")
embed.symbol_dst_subfolder_spec = :plug_ins
[ext, svc].each do |t|
  app.add_dependency(t)
  bf = embed.add_file_reference(t.product_reference, true)
  bf.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
end

project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.set_launch_target(app)
scheme.save_as(path, "NotesWidgetLab", true)
puts path
