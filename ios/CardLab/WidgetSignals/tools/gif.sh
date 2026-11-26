#!/bin/zsh
# gif.sh in.mov out.gif <start s> <seconds> <crop w:h:x:y in pixels> [width]
# A recording of the lab simulator's screen → a small looping GIF (ffmpeg from the repo's node_modules).
FF=${0:A:h}/../../../../node_modules/@ffmpeg-installer/darwin-x64/ffmpeg
$FF -y -loglevel error -ss $3 -t $4 -i $1 \
  -vf "crop=$5,fps=24,scale=${6:-560}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=200:stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" \
  -loop 0 $2 && ls -la $2
