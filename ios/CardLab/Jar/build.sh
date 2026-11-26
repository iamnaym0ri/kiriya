#!/bin/zsh
# Builds the jar lab app for the iOS Simulator with swiftc (no Xcode project), installs it on the lab's
# own simulator ("Kiriya Jar Lab", created if missing) and optionally renders every scenario.
#   ios/CardLab/Jar/build.sh                 build + install
#   ios/CardLab/Jar/build.sh render [only]   … then render frames into $OUT and assemble MP4s/sheets
#   ios/CardLab/Jar/build.sh live [autoplay] … then launch the live card (record with simctl io recordVideo)
set -euo pipefail
LAB=${0:A:h}
JAR=$LAB/../../App/KiriyaNotificationContent/Jar
OUT=${OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/cardlab/jar}
BUILD=$OUT/build
APP=$BUILD/JarLab.app
NAME="Kiriya Jar Lab"
ARCH=$(uname -m)

mkdir -p $APP
xcrun --sdk iphonesimulator swiftc -target $ARCH-apple-ios17.0-simulator -swift-version 5 -O -parse-as-library \
  -module-name JarLab $JAR/*.swift $LAB/Lab/*.swift -o $APP/JarLab
cp $LAB/Lab/Info.plist $APP/Info.plist
cp $JAR/JarGaegu-Regular.ttf $APP/
codesign --force -s - $APP >/dev/null 2>&1 || true

UDID=$(xcrun simctl list devices | grep "$NAME (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/' || true)
if [[ -z "$UDID" ]]; then
  UDID=$(xcrun simctl create "$NAME" "iPhone 17" com.apple.CoreSimulator.SimRuntime.iOS-26-3)
fi
xcrun simctl bootstatus $UDID -b >/dev/null
xcrun simctl install $UDID $APP
echo "installed on $NAME ($UDID)"

case "${1:-}" in
  render)
    xcrun simctl launch --console-pty --terminate-running-process $UDID love.kiriya.jarlab -render $OUT/frames ${2:+-only} ${2:-}
    $LAB/assemble.sh
    ;;
  live)
    xcrun simctl launch --terminate-running-process $UDID love.kiriya.jarlab ${2:+-$2}
    ;;
esac
