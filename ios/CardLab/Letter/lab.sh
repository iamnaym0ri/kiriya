#!/bin/zsh
# The letter card's render lab (macOS). Builds the Letter sources with the lab runner and runs it.
#   ./lab.sh build
#   ./lab.sh all                      stills, contact sheets, idle + opening videos for every note at 343 and 393
#   ./lab.sh <mode> [args…]           any LabMain mode (see Lab/mac/main.swift), output dir first
# Output: $LAB_OUT (default: the session scratchpad's cardlab/letter folder).
set -e
HERE=${0:A:h}
LETTER=$HERE/../../App/KiriyaNotificationContent/Letter
OUT=${LAB_OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/cardlab/letter}
BIN=$HERE/.build/letterlab
mkdir -p $HERE/.build $OUT

build() {
  swiftc -O -swift-version 5 -target x86_64-apple-macos14.0 -module-name LetterLab \
    $LETTER/*.swift $HERE/Lab/LabCore.swift $HERE/Lab/mac/main.swift -o $BIN 2>&1 | grep -v "warning:" | grep -v "^\s*|" | grep -v "^$" || true
  [[ -x $BIN ]] || { echo "build failed"; exit 1; }
}

case "$1" in
  build) build ;;
  all)
    build
    $BIN stills $OUT/stills
    for note in short medium long nobyline; do
      for w in 343 393; do
        $BIN report $note $w
        $BIN sheet $OUT/sheets $note $w 0.1
        $BIN video $OUT/video $note $w
      done
    done
    $BIN idle $OUT/idle medium 343
    $BIN idle $OUT/idle short 393
    ;;
  *)
    [[ -x $BIN ]] || build
    mode=$1; shift
    case $mode in
      report) $BIN report "$@" ;;
      *) $BIN $mode $OUT/${mode}s "$@" ;;
    esac
    ;;
esac
