#!/bin/zsh
# Side-by-side stills, top-aligned on a lilac ground: tools/side.sh out.png a.png b.png …  (SCALE=0.5 to shrink)
set -e
FF=${FFMPEG:-/Users/josh/kiriya/node_modules/@ffmpeg-installer/darwin-x64/ffmpeg}
out=$1; shift
max=0
for f in "$@"; do h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/{print $2}'); (( h > max )) && max=$h; done
inputs=(); filters=""; i=0
for f in "$@"; do
  inputs+=(-i "$f")
  filters+="[$i:v]pad=iw+24:$((max + 24)):12:12:color=0xF3EBF7[p$i];"
  i=$((i + 1))
done
labels=""; for j in $(seq 0 $((i - 1))); do labels+="[p$j]"; done
scale=${SCALE:-1}
$FF -loglevel error -y "${inputs[@]}" -filter_complex "${filters}${labels}hstack=inputs=$i,scale=iw*$scale:-1" "$out"
echo "$out"
