#!/bin/zsh
# Builds the kiriya.love iPhone app on a Mac with Xcode (docs/refactor/IOS-APP.md).
#
#   ios/build.sh testflight   Archive and upload to App Store Connect; it reaches TestFlight after processing
#   ios/build.sh run <udid>   Debug build straight onto your own connected iPhone (xcrun xctrace list devices)
#
# A site deploy reaches the app over the air, without a rebuild. Upload a new build only when native
# pieces change (icons, sounds, plugins, widgets, the notification extension, Info.plist), or every
# ~80 days, before TestFlight's 90-day expiry. Steps for the extension targets: docs/refactor/MAC-BUILD.md. Build numbers go up by themselves (manageAppVersionAndBuildNumber).
# Signing is Xcode's automatic signing for team 9W8CN9V8NR; no keys or secrets are read here.
set -eu
MODE=${1:-}
case "$MODE" in testflight|run) ;; *) print -u2 "usage: $0 testflight | run <device-udid>"; exit 64;; esac

IOS=${0:A:h}
REPO=${IOS:h}
OUT=$REPO/ios/App/build
cd $REPO

npm ci --no-audit --no-fund
# The app ships a copy of the site (capacitor.config.json webDir "dist-app", made by `npm run build`);
# later site changes reach it over the air (@capgo/capacitor-updater).
npm run build
node scripts/make-app-icon.mjs
npx cap sync ios

cd $IOS/App
if [[ $MODE == run ]]; then
  UDID=${2:?"pass the iPhone's UDID"}
  xcodebuild build -project App.xcodeproj -scheme App -configuration Debug \
    -destination "id=$UDID" -allowProvisioningUpdates -derivedDataPath $OUT/derived
  xcrun devicectl device install app --device $UDID $OUT/derived/Build/Products/Debug-iphoneos/App.app
  print "Installed on $UDID."
  exit 0
fi

rm -rf $OUT/kiriya.xcarchive $OUT/export
xcodebuild archive -project App.xcodeproj -scheme App -configuration Release \
  -destination "generic/platform=iOS" -archivePath $OUT/kiriya.xcarchive -allowProvisioningUpdates
xcodebuild -exportArchive -archivePath $OUT/kiriya.xcarchive \
  -exportOptionsPlist $IOS/ExportOptions-testflight.plist -exportPath $OUT/export -allowProvisioningUpdates
print "Uploaded. Apple processes it in ~10–30 minutes; then it appears in App Store Connect → TestFlight,"
print "and testers with Automatic Updates on get it by themselves. Next upload due within 90 days: $(date -v+80d '+%d %b %Y' 2>/dev/null || true)"
