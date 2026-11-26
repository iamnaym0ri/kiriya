#!/bin/zsh
# The con widget's lab, on its own simulator only ("Kiriya Con Widget Lab", iPhone 11, iOS 26.3;
# never any other simulator or device). Built with swiftc, no Xcode project.
#   ./sim.sh create                 make the simulator if it isn't there
#   ./sim.sh build [app]            the lab app + its widget extension + the demo extension (app: the app only)
#   ./sim.sh render [a,b] [overview] render scenarios into $OUT/renders (boards, tiles, overview)
#   ./sim.sh overview               just the overview sheet
#   ./sim.sh checks                 the model checks (Lab/ConLabChecks.swift)
#   ./sim.sh install                install the lab app (and its widgets) on the simulator
#   ./sim.sh place <layout>         put lab widgets on the Home Screen (edits SpringBoard's
#                                   IconState.plist while the simulator is shut down), then boot
#   ./sim.sh style light|dark|tinted|clear   Home Screen icon & widget style (poster config), reboot
#   ./sim.sh shot <name>            screenshot into $OUT/sim
#   ./sim.sh record <name> <secs>   record the screen (HEVC) into $OUT/sim
#   ./sim.sh shutdown
set -e
HERE=${0:A:h}
APPDIR=$HERE/../../App
CON=$APPDIR/KiriyaWidgets/Con
OUT=${LAB_OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/widgets/con}
BUILD=$HERE/.build
APP=$BUILD/ConLab.app
BUNDLE=love.kiriya.conlab
SIM_NAME="Kiriya Con Widget Lab"
mkdir -p $OUT/sim $BUILD

udid() { xcrun simctl list devices | grep "$SIM_NAME (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/'; }
UDID=$(udid)
if [[ "$1" == create ]]; then
  [[ -n $UDID ]] || xcrun simctl create "$SIM_NAME" "iPhone 11" com.apple.CoreSimulator.SimRuntime.iOS-26-3
  udid; exit 0
fi
[[ -n $UDID ]] || { echo "run ./sim.sh create first"; exit 1; }
DATA=~/Library/Developer/CoreSimulator/Devices/$UDID/data

plist() { # <path> <bundle id> <exec> <name> <package type> [extension]
  local ext=""
  [[ -n $6 ]] && ext="<key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict><key>ConLabDemoClock</key><string>$OUT/sim/demo-midnight.txt</string>"
  cat > $1 <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>$2</string>
<key>CFBundleExecutable</key><string>$3</string>
<key>CFBundleName</key><string>$4</string>
<key>CFBundleDisplayName</key><string>$4</string>
<key>CFBundlePackageType</key><string>$5</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>CFBundleVersion</key><string>$(date +%s)</string>
<key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
<key>MinimumOSVersion</key><string>17.0</string>
<key>UIDeviceFamily</key><array><integer>1</integer></array>
<key>CFBundleSupportedPlatforms</key><array><string>iPhoneSimulator</string></array>
<key>UILaunchScreen</key><dict/>
<key>UISupportedInterfaceOrientations</key><array><string>UIInterfaceOrientationPortrait</string></array>
$ext
</dict></plist>
PLIST
}

build() {
  local sdk=$(xcrun --sdk iphonesimulator --show-sdk-path)
  local arch=$(uname -m)
  local common=(-swift-version 5 -parse-as-library -target $arch-apple-ios17.0-simulator -sdk $sdk ${OPT:--Onone})
  local shared=($CON/*.swift $APPDIR/KiriyaShared/KiriyaShared.swift $HERE/Lab/ConLabScenarios.swift)
  [[ $1 == app ]] || rm -rf $APP
  mkdir -p $APP/PlugIns/ConLabWidgets.appex $APP/PlugIns/ConLabDemo.appex
  echo "app…"
  xcrun --sdk iphonesimulator swiftc $common -module-name ConLab $shared \
    $HERE/Lab/ConLabRender.swift $HERE/Lab/ConLabOverview.swift $HERE/Lab/ConLabChecks.swift $HERE/Lab/ConLabApp.swift -o $APP/ConLab 2>&1 | grep -E "error|warning: (var|unused)" || true
  [[ -x $APP/ConLab ]] || { echo "app build failed"; exit 1; }
  local exts=(ConLabWidgets ConLabDemo)
  [[ $1 == app ]] && exts=()
  for ext in $exts; do
    echo "$ext…"
    local flags=()
    [[ $ext == ConLabDemo ]] && flags=(-D CON_DEMO)
    xcrun --sdk iphonesimulator swiftc $common -application-extension $flags -module-name $ext $shared $HERE/Lab/ConLabWidgets.swift \
      -Xlinker -e -Xlinker _NSExtensionMain -o $APP/PlugIns/$ext.appex/$ext 2>&1 | grep -E "error" || true
    [[ -x $APP/PlugIns/$ext.appex/$ext ]] || { echo "$ext build failed"; exit 1; }
    plist $APP/PlugIns/$ext.appex/Info.plist $BUNDLE.${ext:l} $ext "Con Lab" 'XPC!' yes
    cp $CON/Fonts/*.ttf $APP/PlugIns/$ext.appex/
    codesign -s - --force $APP/PlugIns/$ext.appex >/dev/null 2>&1
  done
  plist $APP/Info.plist $BUNDLE ConLab "Con Lab" APPL
  cp $CON/Fonts/*.ttf $APP/
  codesign -s - --force $APP >/dev/null 2>&1
  echo "built $APP"
}

boot() {
  # The busy iMac sometimes fails the first boot ("launchd failed to respond"): try again.
  for attempt in 1 2 3; do
    xcrun simctl list devices | grep "$UDID" | grep -q Booted && break
    xcrun simctl boot $UDID 2>/dev/null && break
    sleep 10
  done
  xcrun simctl bootstatus $UDID -b >/dev/null
}

case "$1" in
  build) build $2 ;;
  install) boot; xcrun simctl install $UDID $APP; echo "installed" ;;
  render)
    boot; xcrun simctl install $UDID $APP
    args=(-render $OUT/renders)
    [[ -n $2 && $2 != all ]] && args+=(-only $2)
    [[ $3 == overview || $4 == overview ]] && args+=(-overview)
    [[ $3 == tiles || $4 == tiles ]] && args+=(-tiles)
    xcrun simctl launch --console-pty --terminate-running-process $UDID $BUNDLE $args
    ;;
  checks)
    boot; xcrun simctl install $UDID $APP
    xcrun simctl launch --console-pty --terminate-running-process $UDID $BUNDLE -checks
    ;;
  overview)
    boot; xcrun simctl install $UDID $APP
    xcrun simctl launch --console-pty --terminate-running-process $UDID $BUNDLE -overview $OUT/renders
    ;;
  live)
    boot; xcrun simctl install $UDID $APP
    xcrun simctl launch --terminate-running-process $UDID $BUNDLE -in ${2:-25}
    ;;
  place)
    xcrun simctl shutdown $UDID 2>/dev/null || true
    python3 $HERE/tools/place.py $DATA/Library/SpringBoard/IconState.plist ${2:-states}
    boot
    ;;
  style)
    xcrun simctl shutdown $UDID 2>/dev/null || true
    python3 $HERE/tools/style.py "$DATA" ${2:-light}
    boot
    ;;
  shot) xcrun simctl io $UDID screenshot $OUT/sim/${2:-shot}.png ;;
  record) xcrun simctl io $UDID recordVideo --force $OUT/sim/${2:-rec}.mov & pid=$!; sleep ${3:-10}; kill -INT $pid; wait $pid 2>/dev/null || true ;;
  shutdown) xcrun simctl shutdown $UDID ;;
  *) echo "see the header of this script" ;;
esac
