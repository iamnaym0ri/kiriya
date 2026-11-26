#!/bin/zsh
# The little-note widget on this lab's own simulator ("Kiriya Notes Widget Lab", iPhone 11, iOS 26.3;
# never any other simulator or device). Builds the lab's own Xcode project (tools/make-sim-project.rb),
# never App.xcodeproj.
#   ./sim.sh create                     make the simulator (once)
#   ./sim.sh build                      generate + build the lab app, widget extension and lab NSE
#   ./sim.sh install                    boot the simulator, install the lab app
#   ./sim.sh scene <name> [suspend]     set the widget's state (clear empty sealed open title long letter sent-…)
#   ./sim.sh deliver [note|letter]      a push's words handed to NotesWidgetMailbox.receive (the NSE path), then Home
#   ./sim.sh push [note|letter]         a real `simctl push` with mutable-content (runs the lab NSE)
#   ./sim.sh shot <name>                screenshot     ./sim.sh record <name> <seconds>   screen recording
#   ./sim.sh appearance light|dark      ./sim.sh shutdown
set -e
HERE=${0:A:h}
OUT=${LAB_OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/widgets/notes}/sim
SIM_NAME="Kiriya Notes Widget Lab"
BUNDLE=love.kiriya.noteswidgetlab
mkdir -p $OUT
udid() { xcrun simctl list devices | grep "$SIM_NAME (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/'; }
UDID=$(udid)
boot() { xcrun simctl list devices | grep "$UDID" | grep -q Booted || { xcrun simctl boot $UDID; sleep 8; }; }
APP=$HERE/.build/sim/dd/Build/Products/Debug-iphonesimulator/NotesWidgetLab.app

case "$1" in
  create)
    [[ -n $UDID ]] && { echo "exists: $UDID"; exit 0; }
    xcrun simctl create "$SIM_NAME" com.apple.CoreSimulator.SimDeviceType.iPhone-11 com.apple.CoreSimulator.SimRuntime.iOS-26-3 ;;
  build)
    ruby $HERE/tools/make-sim-project.rb
    xcodebuild -project $HERE/.build/sim/NotesWidgetLab.xcodeproj -scheme NotesWidgetLab -configuration Debug \
      -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath $HERE/.build/sim/dd build 2>&1 \
      | grep -E "error:|warning: .*Notes|BUILD (SUCCEEDED|FAILED)" | head -40 ;;
  install) boot; xcrun simctl install $UDID $APP && echo installed ;;
  scene)
    boot
    xcrun simctl launch --terminate-running-process $UDID $BUNDLE -scene $2 -suspend ${3:-1} >/dev/null && echo "scene $2" ;;
  deliver)
    boot
    xcrun simctl launch --terminate-running-process $UDID $BUNDLE -deliver ${2:-note} -suspend 1 -deliverAfter ${3:-2.5} >/dev/null && echo "delivered ${2:-note}" ;;
  push)
    boot
    id=$(uuidgen | tr A-Z a-z)
    cat > $OUT/push.json <<JSON
{"aps":{"alert":{"title":"for after your exam","body":"I know today felt long, but I'm so proud of how hard you worked."},"sound":"default","mutable-content":1,"category":"NOTE","thread-id":"notes"},
 "kind":"note","navigate":"/world/notes?open=$id",
 "note":{"id":"$id","title":"for after your exam","text":"I know today felt long, but I'm so proud of how hard you worked. Go get bubble tea, put your feet up and don't think about revision for one whole evening. I'll call you at nine 💜","from":"Josh"}}
JSON
    xcrun simctl push $UDID $BUNDLE $OUT/push.json ;;
  shot) xcrun simctl io $UDID screenshot $OUT/${2:-shot}.png >/dev/null && echo $OUT/${2:-shot}.png ;;
  record)
    rm -f $OUT/$2.mp4
    xcrun simctl io $UDID recordVideo --force $OUT/$2.mp4 & REC=$!
    sleep ${3:-6}; kill -INT $REC; wait $REC 2>/dev/null || true; echo $OUT/$2.mp4 ;;
  appearance) xcrun simctl ui $UDID appearance $2 ;;
  shutdown) xcrun simctl shutdown $UDID ;;
  *) echo "usage: see the top of sim.sh" ;;
esac
