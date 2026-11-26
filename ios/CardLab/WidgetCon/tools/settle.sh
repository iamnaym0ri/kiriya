#!/bin/zsh
# settle.sh <udid> <out.png> — waits until the Home Screen stops changing (widgets loaded), then keeps the shot.
U=$1; OUT=$2; prev=""
for i in {1..30}; do
  xcrun simctl io $U screenshot $OUT >/dev/null 2>&1
  sum=$(md5 -q $OUT)
  [[ $sum == $prev ]] && { echo "settled after $i"; exit 0; }
  prev=$sum; sleep 4
done
echo "not settled"
