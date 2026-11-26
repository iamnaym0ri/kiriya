#!/bin/zsh
# Turns the lab's rendered frames into MP4s and contact sheets: $OUT/videos/<scenario>-w<width>.mp4,
# $OUT/sheets/<scenario>-w<width>.png (and the resting stills into one sheet per width).
set -euo pipefail
OUT=${OUT:-/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/cardlab/jar}
FF=${FF:-/Users/josh/kiriya/node_modules/@ffmpeg-installer/darwin-x64/ffmpeg}
mkdir -p $OUT/videos $OUT/sheets
for dir in $OUT/frames/*/w*(N/); do
  name=${dir:h:t}; width=${dir:t}
  [[ -f $dir/fps.txt ]] || continue
  fps=$(cat $dir/fps.txt | cut -d. -f1)
  count=$(ls $dir/f*.png | wc -l | tr -d ' ')
  $FF -y -loglevel error -framerate $fps -i $dir/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 17 -preset medium \
      -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -movflags +faststart $OUT/videos/$name-$width.mp4
  step=$(( (count + 17) / 18 )); (( step < 1 )) && step=1
  $FF -y -loglevel error -i $dir/f%04d.png -vf "select='not(mod(n\,$step))',scale=iw/3:-1,tile=6x3:padding=6:color=0x222222" \
      -frames:v 1 -vsync vfr $OUT/sheets/$name-$width.png
done
echo "videos: $OUT/videos  sheets: $OUT/sheets"
