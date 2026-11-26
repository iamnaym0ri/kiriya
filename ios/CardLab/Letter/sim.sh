#!/bin/zsh
# The letter card on this lab's own simulator ("Kiriya Letter Lab"; never any other simulator or device).
#   ./sim.sh build                         compile the lab app for the simulator (no Xcode project needed)
#   ./sim.sh live [note] [autoOpenSeconds] install + launch the live card (auto-opens after N s)
#   ./sim.sh record [note] [seconds]       launch live, record the screen to an MP4
#   ./sim.sh render                        iOS ImageRenderer parity frames + per-frame cost report
#   ./sim.sh shot <name>                   screenshot the simulator
# Note: the iOS 26.3 simulator runtime here has no Apple Color Emoji, so emoji show as boxes on the
# simulator only; the macOS lab (lab.sh) renders them properly.
set -e
HERE=${0:A:h}
LETTER=$HERE/../../App/KiriyaNotificationContent/Letter
OUT=${LAB_OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/cardlab/letter}/sim
SIM_NAME="Kiriya Letter Lab"
UDID=$(xcrun simctl list devices | grep "$SIM_NAME (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
[[ -n $UDID ]] || { echo "create it: xcrun simctl create \"$SIM_NAME\" \"iPhone 17\" com.apple.CoreSimulator.SimRuntime.iOS-26-3"; exit 1; }
APP=$HERE/.build/LetterLab.app
BUNDLE=love.kiriya.letterlab
mkdir -p $OUT $HERE/.build

build() {
  local sdk=$(xcrun --sdk iphonesimulator --show-sdk-path)
  local arch=$(uname -m)
  mkdir -p $APP
  xcrun --sdk iphonesimulator swiftc -O -swift-version 5 -parse-as-library -target $arch-apple-ios17.0-simulator -sdk $sdk \
    -module-name LetterLab $LETTER/*.swift $HERE/Lab/LabCore.swift $HERE/Lab/sim/LabApp.swift -o $APP/LetterLab 2>&1 \
    | grep -v "warning:" | grep -v "^\s*|" | grep -v "^$" || true
  [[ -x $APP/LetterLab ]] || { echo "build failed"; exit 1; }
  cp $LETTER/Fonts/*.ttf $APP/
  cat > $APP/Info.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>$BUNDLE</string>
<key>CFBundleExecutable</key><string>LetterLab</string>
<key>CFBundleName</key><string>Letter Lab</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>UILaunchScreen</key><dict/>
<key>MinimumOSVersion</key><string>17.0</string>
<key>UIDeviceFamily</key><array><integer>1</integer></array>
<key>UISupportedInterfaceOrientations</key><array><string>UIInterfaceOrientationPortrait</string></array>
<key>CFBundleSupportedPlatforms</key><array><string>iPhoneSimulator</string></array>
</dict></plist>
PLIST
  codesign -s - --force $APP >/dev/null 2>&1
}

boot() {
  xcrun simctl list devices | grep "$UDID" | grep -q Booted || xcrun simctl boot $UDID
}

case "$1" in
  build) build ;;
  live)
    boot; xcrun simctl install $UDID $APP
    xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    xcrun simctl launch $UDID $BUNDLE -note ${2:-medium} -autoOpen ${3:-2.5}
    ;;
  frames)
    # Frame-gap log while the card idles, opens (at 2s) and rests: ./sim.sh frames [note] [seconds]
    boot; xcrun simctl install $UDID $APP
    xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    ( xcrun simctl launch --console-pty $UDID $BUNDLE -note ${2:-medium} -autoOpen 2 2>&1 | grep --line-buffered "frames=" ) &
    LOG=$!
    sleep ${3:-7}
    xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    wait $LOG 2>/dev/null || true
    ;;
  record)
    boot; xcrun simctl install $UDID $APP
    xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    rm -f $OUT/live-${2:-medium}.mp4
    xcrun simctl io $UDID recordVideo --codec h264 --force $OUT/live-${2:-medium}.mp4 &
    REC=$!
    sleep 1.5
    xcrun simctl launch $UDID $BUNDLE -note ${2:-medium} -autoOpen 2.5 -springFlip ${SPRING:-0}
    sleep ${3:-8}
    kill -INT $REC; wait $REC 2>/dev/null || true
    echo $OUT/live-${2:-medium}.mp4
    ;;
  render)
    boot; xcrun simctl install $UDID $APP
    xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    xcrun simctl launch --console-pty $UDID $BUNDLE -render $OUT 2>&1 | grep -v "Requested font\|IOSurface" || true
    ;;
  shot)
    xcrun simctl io $UDID screenshot $OUT/${2:-shot}.png >/dev/null && echo $OUT/${2:-shot}.png
    ;;
  *) echo "usage: sim.sh build|live|record|render|shot" ;;
esac
