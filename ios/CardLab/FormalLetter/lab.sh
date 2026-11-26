#!/bin/zsh
# The formal letter card's render lab (macOS). Builds the FormalLetter sources with the lab runner.
#   ./lab.sh build
#   ./lab.sh all                      stills, contact sheets, videos, GIF and overview at 343 and 393
#   ./lab.sh <mode> [args…]           any runner mode (see Lab/mac/main.swift); output dir is added
#   SCROLLABLE=0 ./lab.sh …           long letters stop with "the rest is waiting in the app"
# Output: $LAB_OUT (default: the session scratchpad's cardlab/formal-letter folder).
set -e
HERE=${0:A:h}
CARD=$HERE/../../App/KiriyaNotificationContent/FormalLetter
OUT=${LAB_OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/cardlab/formal-letter}
BIN=$HERE/.build/formallab
mkdir -p $HERE/.build $OUT

build() {
  rm -f $BIN
  swiftc -O -swift-version 5 -target x86_64-apple-macos14.0 -module-name FormalLab \
    $CARD/*.swift $HERE/Lab/LabCore.swift $HERE/Lab/mac/main.swift -o $BIN 2>&1 | grep -E "error|warning: .*FormalLetter/" || true
  [[ -x $BIN ]] || { echo "build failed"; exit 1; }
}

case "$1" in
  build) build ;;
  all)
    build
    $BIN stills $OUT/stills
    for w in 343 393; do
      $BIN overview $OUT/overview $w
      $BIN edges $OUT/edges $w
      for l in medium short long openwhen maomao; do
        $BIN report $l $w
        $BIN sheet $OUT/sheets $l $w 0.1
        $BIN video $OUT/video $l $w
      done
      $BIN idle $OUT/idle medium $w
      $BIN idle $OUT/idle locked $w
    done
    $BIN gif $OUT/gif medium 343
    $BIN restgif $OUT/gif short 343 6.5
    for l in short maomao; do for w in 343 393; do $BIN crest $OUT/crest $l $w; done; done
    SCROLLABLE=0 $BIN stills $OUT/stills-noscroll long
    ;;
  *)
    [[ -x $BIN ]] || build
    mode=$1; shift
    case $mode in
      report|speak) $BIN $mode "$@" ;;
      stills|edges|sheet|frame|idle|video|gif|overview|piece) $BIN $mode $OUT/${mode%s}s "$@" ;;
      restgif) $BIN $mode $OUT/gif "$@" ;;
      crest) $BIN $mode $OUT/crest "$@" ;;
      *) $BIN $mode $OUT/$mode "$@" ;;
    esac
    ;;
esac
