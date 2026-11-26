#!/bin/zsh
# The little-note widget's render lab (macOS). Builds the widget's views (ios/App/KiriyaWidgets/Notes)
# with the lab runner and runs it. Nothing here touches the network.
#   ./lab.sh build
#   ./lab.sh all                 sheets (iPhone 11 + 6.7"), every state as its own PNG, overview, edges, GIFs
#   ./lab.sh <mode> [args…]      any noteslab mode (see Lab/mac/main.swift), output dir first
#   ./lab.sh typecheck           the Notes folder + the widget target's files + KiriyaShared, against the iOS SDK
# Output: $LAB_OUT (default: the session scratchpad's widgets/notes folder).
set -e
HERE=${0:A:h}
NOTES=$HERE/../../App/KiriyaWidgets/Notes
OUT=${LAB_OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/widgets/notes}
BIN=$HERE/.build/noteslab
mkdir -p $HERE/.build $OUT

build() {
  # Everything but the WidgetKit configuration and the iOS 26 push handler (iOS-only APIs).
  local files=(${NOTES}/*.swift(N))
  files=(${files:#*NotesWidget.swift})
  files=(${files:#*NotesWidgetPush.swift})
  swiftc -Onone -swift-version 5 -target $(uname -m)-apple-macos14.0 -module-name NotesLab \
    $files $HERE/../../App/KiriyaShared/KiriyaShared.swift $HERE/Lab/mac/main.swift -o $BIN 2>&1 \
    | grep -v "warning:" | grep -v "^\s*|" | grep -v "^$" || true
  [[ -x $BIN ]] || { echo "build failed"; exit 1; }
}

case "$1" in
  build) rm -f $BIN; build ;;
  typecheck)
    SDK=$(xcrun --sdk iphoneos --show-sdk-path)
    xcrun --sdk iphoneos swiftc -typecheck -swift-version 5 -target arm64-apple-ios17.0 -sdk $SDK -module-name KiriyaWidgets \
      -application-extension $HERE/../../App/KiriyaWidgets/*.swift $NOTES/*.swift $HERE/../../App/KiriyaShared/*.swift && echo "typecheck: clean"
    ;;
  all)
    rm -f $BIN; build
    $BIN sheet $OUT/sheets 11
    $BIN sheet $OUT/sheets 67
    $BIN states $OUT/states 11
    $BIN states $OUT/states 67
    $BIN overview $OUT
    $BIN edges $OUT
    for f in small medium large; do $BIN gif $OUT/gif $f 11; done
    ;;
  *)
    [[ -x $BIN ]] || build
    mode=$1; shift
    $BIN $mode $OUT "$@"
    ;;
esac
