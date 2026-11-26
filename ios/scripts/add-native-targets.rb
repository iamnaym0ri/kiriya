# Wires the phase-4b native pieces into ios/App/App.xcodeproj (docs/refactor/MAC-BUILD.md §1–§5),
# without clicking through Xcode. Safe to re-run: anything already present is left alone.
#
#   gem install --user-install xcodeproj   (MIT, the CocoaPods project library)
#   ruby ios/scripts/add-native-targets.rb
#
# What it does:
#   App target      + MainViewController, KiriyaNotifications, KiriyaAppShortcuts (sources),
#                     PrivacyInfo.xcprivacy and Sounds/*.caf as a group (bundle root resources)
#   KiriyaShared    group; both files compile into App and KiriyaWidgets
#   KiriyaWidgets   widget extension (love.kiriya.app.widgets)
#   KiriyaNotificationService   notification service extension (love.kiriya.app.notifications)
#   KiriyaNotificationContent   notification content extension (love.kiriya.app.notecard)
#   App target      embeds the .appex files and depends on them
require "xcodeproj"

TEAM = "9W8CN9V8NR"
IOS = File.expand_path("..", __dir__)
project = Xcodeproj::Project.open(File.join(IOS, "App", "App.xcodeproj"))
app = project.targets.find { |t| t.name == "App" } or abort("no App target")
main_group = project.main_group

def file_in(group, name, source_tree: "<group>")
  group.files.find { |f| f.path == name } || group.new_reference(name, source_tree)
end

def add_source(target, ref)
  target.source_build_phase.add_file_reference(ref, true)
end

def add_resource(target, ref)
  target.resources_build_phase.add_file_reference(ref, true)
end

# --- App target -------------------------------------------------------------------------------
app_group = main_group.children.find { |g| g.display_name == "App" && g.isa == "PBXGroup" }
%w[MainViewController.swift KiriyaNotifications.swift KiriyaAppShortcuts.swift].each do |name|
  add_source(app, file_in(app_group, name))
end
add_resource(app, file_in(app_group, "PrivacyInfo.xcprivacy"))
file_in(app_group, "App.entitlements")

sounds = app_group.children.find { |g| g.display_name == "Sounds" } || app_group.new_group("Sounds", "Sounds")
%w[chat.caf tap.caf letter.caf jar.caf].each { |name| add_resource(app, file_in(sounds, name)) }

# --- KiriyaShared (App + widgets) -------------------------------------------------------------
shared = main_group.children.find { |g| g.display_name == "KiriyaShared" } || main_group.new_group("KiriyaShared", "KiriyaShared")
shared_refs = %w[KiriyaShared.swift KiriyaIntents.swift].map { |name| file_in(shared, name) }
shared_refs.each { |ref| add_source(app, ref) }

# --- Extension targets ------------------------------------------------------------------------
def extension_target(project, name, bundle_id)
  target = project.targets.find { |t| t.name == name }
  return target if target

  target = project.new_target(:app_extension, name, :ios, "17.0", project.products_group, :swift)
  target.build_configurations.each do |config|
    s = config.build_settings
    s["PRODUCT_NAME"] = "$(TARGET_NAME)"
    s["PRODUCT_BUNDLE_IDENTIFIER"] = bundle_id
    s["INFOPLIST_FILE"] = "#{name}/#{name}-Info.plist"
    s["GENERATE_INFOPLIST_FILE"] = "NO"
    s["CODE_SIGN_ENTITLEMENTS"] = "#{name}/#{name}.entitlements"
    s["CODE_SIGN_STYLE"] = "Automatic"
    s["DEVELOPMENT_TEAM"] = TEAM
    s["IPHONEOS_DEPLOYMENT_TARGET"] = "17.0"
    s["SWIFT_VERSION"] = "5.0"
    s["MARKETING_VERSION"] = "1.0"
    s["CURRENT_PROJECT_VERSION"] = "1"
    s["TARGETED_DEVICE_FAMILY"] = "1"
    s["SKIP_INSTALL"] = "YES"
    s["APPLICATION_EXTENSION_API_ONLY"] = "YES"
    s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"]
    s["SWIFT_ACTIVE_COMPILATION_CONDITIONS"] = config.name == "Debug" ? "DEBUG" : ""
    s.delete("SWIFT_OPTIMIZATION_LEVEL") if config.name == "Release"
  end
  target
end

widgets = extension_target(project, "KiriyaWidgets", "love.kiriya.app.widgets")
widgets_group = main_group.children.find { |g| g.display_name == "KiriyaWidgets" } || main_group.new_group("KiriyaWidgets", "KiriyaWidgets")
%w[WidgetsMain.swift WidgetProvider.swift WidgetViews.swift WidgetTheme.swift].each do |name|
  add_source(widgets, file_in(widgets_group, name))
end
add_resource(widgets, file_in(widgets_group, "PrivacyInfo.xcprivacy"))
file_in(widgets_group, "KiriyaWidgets-Info.plist")
file_in(widgets_group, "KiriyaWidgets.entitlements")
shared_refs.each { |ref| add_source(widgets, ref) }

service = extension_target(project, "KiriyaNotificationService", "love.kiriya.app.notifications")
service_group = main_group.children.find { |g| g.display_name == "KiriyaNotificationService" } ||
                main_group.new_group("KiriyaNotificationService", "KiriyaNotificationService")
add_source(service, file_in(service_group, "KiriyaNotificationService.swift"))
%w[envelope.png jar.png].each { |name| add_resource(service, file_in(service_group, name)) }
file_in(service_group, "KiriyaNotificationService-Info.plist")
file_in(service_group, "KiriyaNotificationService.entitlements")

# The note card: little notes open, and the jar gives one up, right inside the notification.
content = extension_target(project, "KiriyaNotificationContent", "love.kiriya.app.notecard")
content_group = main_group.children.find { |g| g.display_name == "KiriyaNotificationContent" } ||
                main_group.new_group("KiriyaNotificationContent", "KiriyaNotificationContent")
%w[NotificationViewController.swift NoteCardView.swift].each { |name| add_source(content, file_in(content_group, name)) }
add_resource(content, file_in(content_group, "PrivacyInfo.xcprivacy"))
file_in(content_group, "KiriyaNotificationContent-Info.plist")
file_in(content_group, "KiriyaNotificationContent.entitlements")
add_source(content, shared_refs.find { |ref| ref.path == "KiriyaShared.swift" })
# Linked explicitly: the code only adopts UNNotificationContentExtension (an Objective-C protocol), so
# the linker would drop the auto-linked framework, and iOS then can't load the extension at all
# (a SIGTRAP in +[EXConcreteExtensionContextVendor _extensionContextClass], seen 2026-11-25).
content.add_system_framework("UserNotificationsUI") unless content.frameworks_build_phase.files.any? { |f| f.display_name == "UserNotificationsUI.framework" }
# Point it at the current SDK, as Xcode itself does (the gem writes a fixed SDK version into the path).
project.files.select { |f| f.path.to_s.end_with?("UserNotificationsUI.framework") }.each do |ref|
  ref.source_tree = "SDKROOT"
  ref.path = "System/Library/Frameworks/UserNotificationsUI.framework"
end
# The cards draw everything themselves, so the service extension's envelope and jar pictures
# (attached to the pushes) aren't copied in here any more.
content.resources_build_phase.files.select { |f| %w[envelope.png jar.png].include?(f.display_name) }.each do |build_file|
  content.resources_build_phase.remove_build_file(build_file)
end

# The cards themselves, each in its own folder: Letter/ (the little note's envelope) and Jar/ (the
# note jar). Every .swift file compiles into the extension; the fonts (the site's Gaegu and
# Parisienne, OFL) and their licences go in as resources at the bundle root.
def subgroup(parent, name)
  parent.children.find { |g| g.isa == "PBXGroup" && g.display_name == name } || parent.new_group(name, name)
end
content_dir = File.join(IOS, "App", "KiriyaNotificationContent")
(ENV["CARDS"]&.split(",") || %w[Letter Jar]).each do |card|
  dir = File.join(content_dir, card)
  next unless File.directory?(dir)
  group = subgroup(content_group, card)
  Dir.children(dir).sort.each do |name|
    path = File.join(dir, name)
    if File.directory?(path)
      fonts = subgroup(group, name)
      Dir.children(path).sort.grep(/\.(ttf|otf|txt)\z/).each { |font| add_resource(content, file_in(fonts, font)) }
    elsif name.end_with?(".swift")
      add_source(content, file_in(group, name))
    elsif name.match?(/\.(ttf|otf|txt)\z/)
      add_resource(content, file_in(group, name))
    end
  end
end

# --- Embed the extensions in the app ----------------------------------------------------------
embed = app.copy_files_build_phases.find { |p| p.name == "Embed Foundation Extensions" } ||
        app.new_copy_files_build_phase("Embed Foundation Extensions").tap do |phase|
          phase.symbol_dst_subfolder_spec = :plug_ins
          phase.dst_path = ""
        end
[widgets, service, content].each do |ext|
  app.add_dependency(ext) unless app.dependencies.any? { |d| d.target == ext }
  next if embed.files_references.include?(ext.product_reference)
  build_file = embed.add_file_reference(ext.product_reference, true)
  build_file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
end

project.save
puts "Saved #{project.path}"
project.targets.each do |t|
  puts "#{t.name}: #{t.source_build_phase.files.map(&:display_name).join(', ')} | res: #{t.resources_build_phase.files.map(&:display_name).join(', ')}"
end
