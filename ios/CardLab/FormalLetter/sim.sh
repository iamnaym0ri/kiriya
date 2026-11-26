#!/bin/zsh
# The formal letter card on this lab's own simulator ("Kiriya Formal Letter Lab"; never any other
# simulator or device).
#   ./sim.sh create                         make the simulator (iPhone 17, iOS 26.3) if it isn't there
#   ./sim.sh build                          compile the lab app for the simulator (no Xcode project)
#   ./sim.sh live [letter] [autoOpenSeconds] [extra launch args…]
#   ./sim.sh record [letter] [seconds] [extra launch args…]   launch live and record the screen (MP4)
#   ./sim.sh frames [letter] [seconds]      frame-gap log while it idles, opens (at 2s) and rests
#   ./sim.sh render                         iOS ImageRenderer parity frames + per-frame cost report
#   ./sim.sh shot <name>                    screenshot the simulator
#   ./sim.sh reducemotion on|off            the simulator's Reduce Motion setting
#   ./sim.sh shutdown
#   SPRING=1 flips isOpen inside withAnimation(.spring) like NoteCardModel; WIDTH=343 sets the card width.
# The iOS 26.3 simulator runtime here has no Apple Color Emoji, so emoji show as boxes on the
# simulator only; the macOS lab (lab.sh) renders them properly.
set -e
HERE=${0:A:h}
CARD=$HERE/../../App/KiriyaNotificationContent/FormalLetter
OUT=${LAB_OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/cardlab/formal-letter}/sim
SIM_NAME="Kiriya Formal Letter Lab"
APP=$HERE/.build/FormalLab.app
BUNDLE=love.kiriya.formallab
mkdir -p $OUT $HERE/.build

udid() { xcrun simctl list devices | grep "$SIM_NAME (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/'; }
UDID=$(udid)
if [[ "$1" == create ]]; then
  [[ -n $UDID ]] || xcrun simctl create "$SIM_NAME" "iPhone 17" com.apple.CoreSimulator.SimRuntime.iOS-26-3
  udid; exit 0
fi
[[ -n $UDID ]] || { echo "run ./sim.sh create first"; exit 1; }

build() {
  local sdk=$(xcrun --sdk iphonesimulator --show-sdk-path)
  local arch=$(uname -m)
  rm -rf $APP; mkdir -p $APP
  xcrun --sdk iphonesimulator swiftc -O -swift-version 5 -parse-as-library -target $arch-apple-ios17.0-simulator -sdk $sdk \
    -module-name FormalLab $CARD/*.swift $HERE/Lab/LabCore.swift $HERE/Lab/sim/LabApp.swift -o $APP/FormalLab 2>&1 \
    | grep -E "error" || true
  [[ -x $APP/FormalLab ]] || { echo "build failed"; exit 1; }
  cp $CARD/Fonts/*.ttf $APP/
  cat > $APP/Info.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>$BUNDLE</string>
<key>CFBundleExecutable</key><string>FormalLab</string>
<key>CFBundleName</key><string>Formal Letter Lab</string>
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
  xcrun simctl list devices | grep "$UDID" | grep -q Booted || { xcrun simctl boot $UDID; sleep 4; }
}

launch_args() {
  local letter=$1; shift
  local args=(-letter $letter -springFlip ${SPRING:-0})
  [[ -n $WIDTH ]] && args+=(-width $WIDTH)
  echo "${args[@]} $@"
}

case "$1" in
  build) build ;;
  live)
    boot; xcrun simctl install $UDID $APP
    xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    letter=${2:-medium}; open=${3:-2.5}; shift 3 2>/dev/null || shift $#
    xcrun simctl launch $UDID $BUNDLE $(launch_args $letter -autoOpen $open "$@")
    ;;
  frames)
    boot; xcrun simctl install $UDID $APP
    xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    ( xcrun simctl launch --console-pty $UDID $BUNDLE $(launch_args ${2:-medium} -autoOpen 2) 2>&1 | grep --line-buffered -E "frames=|autoScroll|retap|gap |flip at" ) &
    LOG=$!
    sleep ${3:-7}
    xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    wait $LOG 2>/dev/null || true
    ;;
  record)
    boot; xcrun simctl install $UDID $APP
    xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    letter=${2:-medium}; secs=${3:-8}; shift 3 2>/dev/null || shift $#
    name=live-$letter${SPRING:+-spring}${WIDTH:+-$WIDTH}${TAG:+-$TAG}
    rm -f $OUT/$name.mp4
    xcrun simctl io $UDID recordVideo --force $OUT/$name.mp4 &
    REC=$!
    sleep 1.5
    xcrun simctl launch $UDID $BUNDLE $(launch_args $letter "$@")
    sleep $secs
    kill -INT $REC; wait $REC 2>/dev/null || true
    echo $OUT/$name.mp4
    ;;
  render)
    boot; xcrun simctl install $UDID $APP
    xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    xcrun simctl launch --console-pty $UDID $BUNDLE -render $OUT 2>&1 | grep -v "Requested font\|IOSurface" || true
    ;;
  shot)
    xcrun simctl io $UDID screenshot $OUT/${2:-shot}.png >/dev/null && echo $OUT/${2:-shot}.png
    ;;
  reducemotion)
    boot
    v=$([[ $2 == on ]] && echo true || echo false)
    xcrun simctl spawn $UDID defaults write com.apple.Accessibility ReduceMotionEnabled -bool $v
    xcrun simctl spawn $UDID notifyutil -p com.apple.accessibility.reduce.motion.status >/dev/null 2>&1 || true
    echo "reduce motion $2"
    ;;
  shutdown) xcrun simctl shutdown $UDID 2>/dev/null || true ;;
  *) echo "usage: sim.sh create|build|live|record|frames|render|shot|reducemotion|shutdown" ;;
esac
