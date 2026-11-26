#!/bin/zsh
# Finds "pops": frames whose difference from the previous frame is far above their neighbours'.
#   tools/pops.sh <frames dir with f%04d.png> [fps]
set -euo pipefail
FF=${FF:-/Users/josh/kiriya/node_modules/@ffmpeg-installer/darwin-x64/ffmpeg}
dir=$1; fps=${2:-60}
$FF -loglevel error -i $dir/f%04d.png -vf "crop=iw:${CROP:-ih}:0:36,scale=iw/3:-1,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - \
 | awk -v fps=$fps '/YAVG/ { split($0,a,"="); v[n++]=a[2] } END {
     for (i=0;i<n;i++) { lo=i-3<0?0:i-3; hi=i+3>=n?n-1:i+3; s=0; c=0; for (j=lo;j<=hi;j++) if (j!=i) { s+=v[j]; c++ } m=s/c;
       if (v[i] > 0.3 && v[i] > 1.9*m + 0.12) printf("  pop? frame %d→%d  diff %.2f vs neighbours %.2f\n", i, i+1, v[i], m) ; if (v[i]>mx) mx=v[i] }
     printf("  %d diffs, max %.2f\n", n, mx) }'
