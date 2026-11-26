#!/bin/zsh
# Side-by-side sheet of PNGs: sheet.sh out.png scale_divisor in1.png in2.png …  (tops aligned, dark padding)
set -euo pipefail
FF=${FF:-/Users/josh/kiriya/node_modules/@ffmpeg-installer/darwin-x64/ffmpeg}
out=$1; div=$2; shift 2
inputs=(); filters=""; labels=""
i=0
for f in "$@"; do
  inputs+=(-i "$f")
  filters+="[$i]pad=iw+24:2700:12:0:0x111111[p$i];"
  labels+="[p$i]"
  i=$((i+1))
done
$FF -y -loglevel error "${inputs[@]}" -filter_complex "${filters}${labels}hstack=$i,scale=iw/$div:-1" "$out"
