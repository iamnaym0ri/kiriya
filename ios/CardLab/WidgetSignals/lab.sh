#!/bin/zsh
# The Signals widget's render lab (macOS). Builds ios/App/KiriyaWidgets/Signals + KiriyaShared with the
# lab runner (no Xcode project) and runs it.
#   ./lab.sh build
#   ./lab.sh stills                     every family × state × appearance + contact sheets
#   ./lab.sh scene <id-prefix> [appearance]
#   ./lab.sh typecheck                  the widget target (existing files + Signals) for arm64-apple-ios17.0
# Output: $LAB_OUT (default: the session scratchpad's widgets/signals folder).
set -e
HERE=${0:A:h}
APPDIR=$HERE/../../App
SIGNALS=$APPDIR/KiriyaWidgets/Signals
OUT=${LAB_OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/widgets/signals}
BIN=$HERE/.build/signalslab
mkdir -p $HERE/.build $OUT

build() {
  rm -f $BIN
  swiftc -Onone -swift-version 5 -target x86_64-apple-macos14.0 -module-name SignalsLab -D SIGNALS_LAB \
    $SIGNALS/*.swift $APPDIR/KiriyaShared/*.swift $HERE/Lab/LabCore.swift $HERE/Lab/mac/main.swift -o $BIN 2>&1 \
    | grep -E "error" -A3 || true
  [[ -x $BIN ]] || { echo "build failed"; exit 1; }
}

case "$1" in
  build) build ;;
  typecheck)
    SDK=$(xcrun --sdk iphoneos --show-sdk-path)
    xcrun --sdk iphoneos swiftc -typecheck -swift-version 5 -target arm64-apple-ios17.0 -sdk $SDK -module-name KiriyaWidgets \
      -application-extension $APPDIR/KiriyaShared/*.swift $APPDIR/KiriyaWidgets/*.swift $SIGNALS/*.swift 2>&1 | grep -E "error|warning" || echo "typecheck clean"
    ;;
  stills) build; $BIN stills $OUT/renders ;;
  scene) [[ -x $BIN ]] || build; $BIN scene $OUT/scenes "${@:2}" ;;
  overview) build; $BIN overview $OUT ;;
  *) echo "usage: lab.sh build|stills|scene|typecheck" ;;
esac
