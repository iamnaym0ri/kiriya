#!/bin/zsh
# demo.sh [record seconds] — records the countdown demo on the lab simulator's Home Screen. The
# demo widget (Lab/ConLabWidgets.swift, CON_DEMO) stages a Singapore midnight 330 s into every
# ten-minute slot of the clock. This script waits for a slot to begin, reinstalls the lab app (an
# app update makes WidgetKit ask for fresh timelines), and records across the staged midnight.
# Run `./sim.sh place demo` once first.
HERE=${0:A:h}/..
SIM_NAME="Kiriya Con Widget Lab"
U=$(xcrun simctl list devices | grep "$SIM_NAME (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
OUT=${LAB_OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/widgets/con}/sim
APP=$HERE/.build/ConLab.app
while (( $(date +%s) % 600 > 40 )); do sleep 5; done
slot=$(( $(date +%s) / 600 * 600 )); midnight=$(( slot + 330 ))
xcrun simctl install $U $APP
while (( $(date +%s) < midnight - ${2:-75} )); do sleep 2; done
start=$(date +%s)
xcrun simctl io $U recordVideo --force $OUT/demo.mov &
pid=$!
sleep ${1:-110}
kill -INT $pid; wait $pid 2>/dev/null
echo "recording started $start; staged midnight at $midnight (+$(( midnight - start )) s into the recording)"
