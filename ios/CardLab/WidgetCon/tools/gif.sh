#!/bin/zsh
# gif.sh <in.mov> <out.gif> <start s> <duration s> [crop w:h:x:y in px] [fps] [width px]
# A small looping GIF from a simulator recording (ffmpeg from the repo's node_modules).
FF=${FF:-/Users/josh/kiriya/node_modules/@ffmpeg-installer/darwin-x64/ffmpeg}
IN=$1; OUT=$2; SS=$3; T=$4; CROP=${5:-750:780:40:120}; FPS=${6:-12}; W=${7:-420}
PAL=${OUT:r}-palette.png
$FF -v error -y -ss $SS -t $T -i $IN -vf "crop=$CROP,fps=$FPS,scale=$W:-1:flags=lanczos,palettegen=stats_mode=diff" $PAL
$FF -v error -y -ss $SS -t $T -i $IN -i $PAL -lavfi "crop=$CROP,fps=$FPS,scale=$W:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle" $OUT
rm -f $PAL
ls -la $OUT
