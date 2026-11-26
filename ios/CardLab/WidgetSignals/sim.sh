#!/bin/zsh
# The Signals widget on this lab's own simulator ("Kiriya Signals Widget Lab"; never any other simulator or
# device). Builds a lab Xcode project (tools/make_project.rb → .build/SignalsLab.xcodeproj; host app + widget
# extension, stubbed network) with xcodebuild, so the App Intents metadata is real.
#   ./sim.sh create                  create the lab simulator (iPhone 11, iOS 26.3)
#   ./sim.sh build                   generate the project and build for the simulator
#   ./sim.sh install                 install the lab app (and its widget extension)
#   ./sim.sh place                   shut down, put the lab widgets on the Home Screen, boot
#   ./sim.sh shot <name>             screenshot
#   ./sim.sh record <name> <seconds> record the screen (HEVC .mov)
#   ./sim.sh live <family> <seconds> record the in-app live face (fallback for the GIF)
#   ./sim.sh render                  iOS ImageRenderer parity frames
#   ./sim.sh wda | wda-stop          my own WebDriverAgent on port 8200 (tools/wda.py taps)
#   ./sim.sh shutdown
set -e
HERE=${0:A:h}
OUT=${LAB_OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/widgets/signals}/sim
SIM_NAME="Kiriya Signals Widget Lab"
UDID=$(xcrun simctl list devices | grep "$SIM_NAME (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
APP=$HERE/.build/xc/app-Debug-iphonesimulator/SignalsLab.app
BUNDLE=love.kiriya.signalslab
mkdir -p $OUT

boot() { xcrun simctl list devices | grep "$UDID" | grep -q Booted || { xcrun simctl boot $UDID; xcrun simctl bootstatus $UDID -b >/dev/null; } }

case "$1" in
  create) xcrun simctl create "$SIM_NAME" com.apple.CoreSimulator.SimDeviceType.iPhone-11 com.apple.CoreSimulator.SimRuntime.iOS-26-3 ;;
  build)
    ruby $HERE/tools/make_project.rb
    xcodebuild -project $HERE/.build/SignalsLab.xcodeproj -target SignalsLab -sdk iphonesimulator -configuration Debug \
      ARCHS=x86_64 ONLY_ACTIVE_ARCH=YES SYMROOT=$HERE/.build/xc OBJROOT=$HERE/.build/xc/obj build 2>&1 \
      | grep -E "error:|BUILD (SUCCEEDED|FAILED)" | head -20
    ;;
  install) boot; xcrun simctl install $UDID $APP && echo installed ;;
  place)
    xcrun simctl shutdown $UDID 2>/dev/null || true
    rm -f ~/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/SpringBoard/DesiredIconState.plist
    python3 -I $HERE/tools/place_widgets.py $UDID ${2:-real}
    boot
    ;;
  shot) xcrun simctl io $UDID screenshot $OUT/${2:-shot}.png >/dev/null && echo $OUT/${2:-shot}.png ;;
  record)
    rm -f $OUT/${2:-rec}.mov
    xcrun simctl io $UDID recordVideo --force $OUT/${2:-rec}.mov 2>/dev/null &
    REC=$!
    sleep ${3:-12}
    kill -INT $REC; wait $REC 2>/dev/null || true
    echo $OUT/${2:-rec}.mov
    ;;
  live)
    boot; xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    rm -f $OUT/live-${2:-small}.mov
    xcrun simctl launch $UDID $BUNDLE -live ${2:-small} >/dev/null
    sleep 1
    xcrun simctl io $UDID recordVideo --force $OUT/live-${2:-small}.mov 2>/dev/null &
    REC=$!
    sleep ${3:-8}
    kill -INT $REC; wait $REC 2>/dev/null || true
    xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    echo $OUT/live-${2:-small}.mov
    ;;
  render)
    boot; xcrun simctl terminate $UDID $BUNDLE 2>/dev/null || true
    xcrun simctl launch --console-pty $UDID $BUNDLE -render $OUT/render 2>&1 | grep "rendered" || true
    ;;
  wda)
    # My own WebDriverAgent build (scratchpad/wda), on port 8200, for this simulator only.
    W=/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/wda
    RUN=$(ls $W/dd/Build/Products/*.xctestrun | head -1)
    TEST_RUNNER_USE_PORT=8200 xcodebuild test-without-building -xctestrun $RUN -destination "id=$UDID" > $W/runner.log 2>&1 &
    until curl -s -m 2 http://127.0.0.1:8200/status | grep -q ready; do sleep 2; done
    echo "WDA ready on 8200"
    ;;
  wda-stop) pkill -f "scratchpad/wda/dd/Build/Products" || true ;;
  shutdown) xcrun simctl shutdown $UDID ;;
  *) echo "usage: sim.sh create|build|install|place|shot|record|live|render|shutdown" ;;
esac
