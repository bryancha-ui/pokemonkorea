#!/usr/bin/env bash
set -euo pipefail

ending_dir="$(cd "$(dirname "$0")" && pwd)"
generated_dir="$ending_dir/generated"
segment_dir="$ending_dir/segments"
montage_dir="$ending_dir/montage"
music_file="$ending_dir/music/pokemon_korea_ending_score_5min_composed.m4a"
mkdir -p "$segment_dir"

ride_names=(
  01_dawn_meadow
  02_rice_flowers
  03_ancient_forest
  04_lantern_city
  05_jeju_coast
  06_volcanic_dusk
  07_spirit_twilight
  08_baekdu_night
)

for ride_name in "${ride_names[@]}"; do
  if [ -s "$segment_dir/$ride_name.mp4" ]; then
    continue
  fi
  ffmpeg -y -i "$generated_dir/$ride_name.mp4" \
    -vf "trim=duration=15,setpts=2*(PTS-STARTPTS),fps=24,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=yuv420p" \
    -an -t 30 -c:v libx264 -preset medium -crf 19 -movflags +faststart \
    "$segment_dir/$ride_name.mp4"
done

# Dawn reprise before the credits, then a slower/darker 39-second credits plate.
if [ ! -s "$segment_dir/09_dawn_reprise.mp4" ]; then
  cp -p "$segment_dir/01_dawn_meadow.mp4" "$segment_dir/09_dawn_reprise.mp4"
fi
if [ ! -s "$segment_dir/10_credits_plate.mp4" ]; then
  ffmpeg -y -i "$generated_dir/01_dawn_meadow.mp4" \
    -vf "trim=duration=15,setpts=2.6*(PTS-STARTPTS),fps=24,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=brightness=-0.22:saturation=0.82,vignette=PI/4,format=yuv420p" \
    -an -t 39 -c:v libx264 -preset medium -crf 19 -movflags +faststart \
    "$segment_dir/10_credits_plate.mp4"
fi

# Ten landscape passages, joined with one-second dissolves. 309 seconds of
# source minus nine one-second overlaps gives an exact five-minute base.
ffmpeg -y \
  -i "$segment_dir/01_dawn_meadow.mp4" \
  -i "$segment_dir/02_rice_flowers.mp4" \
  -i "$segment_dir/03_ancient_forest.mp4" \
  -i "$segment_dir/04_lantern_city.mp4" \
  -i "$segment_dir/05_jeju_coast.mp4" \
  -i "$segment_dir/06_volcanic_dusk.mp4" \
  -i "$segment_dir/07_spirit_twilight.mp4" \
  -i "$segment_dir/08_baekdu_night.mp4" \
  -i "$segment_dir/09_dawn_reprise.mp4" \
  -i "$segment_dir/10_credits_plate.mp4" \
  -filter_complex "\
    [0:v][1:v]xfade=transition=fade:duration=1:offset=29[x1];\
    [x1][2:v]xfade=transition=fade:duration=1:offset=58[x2];\
    [x2][3:v]xfade=transition=fade:duration=1:offset=87[x3];\
    [x3][4:v]xfade=transition=fade:duration=1:offset=116[x4];\
    [x4][5:v]xfade=transition=fade:duration=1:offset=145[x5];\
    [x5][6:v]xfade=transition=fade:duration=1:offset=174[x6];\
    [x6][7:v]xfade=transition=fade:duration=1:offset=203[x7];\
    [x7][8:v]xfade=transition=fade:duration=1:offset=232[x8];\
    [x8][9:v]xfade=transition=fade:duration=1:offset=261,format=yuv420p[base]" \
  -map "[base]" -an -t 300 -c:v libx264 -preset medium -crf 19 -movflags +faststart \
  "$ending_dir/ending_credits_base.mp4"

# Story-memory windows pass like recollections while the ride continues below.
ffmpeg -y \
  -i "$ending_dir/ending_credits_base.mp4" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m01_starters.png" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m02_rival.png" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m03_badges.png" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m04_forest.png" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m05_ferry.png" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m06_nabi.png" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m07_halloffame.png" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m08_inspectorate.png" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m09_trio.png" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m10_hideout.png" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m11_hwanung.png" \
  -loop 1 -framerate 24 -t 10 -i "$montage_dir/m12_descent.png" \
  -i "$music_file" \
  -filter_complex "\
    [1:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+35/TB[m1];\
    [2:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+50/TB[m2];\
    [3:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+65/TB[m3];\
    [4:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+85/TB[m4];\
    [5:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+105/TB[m5];\
    [6:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+128/TB[m6];\
    [7:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+150/TB[m7];\
    [8:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+175/TB[m8];\
    [9:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+195/TB[m9];\
    [10:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+214/TB[m10];\
    [11:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+232/TB[m11];\
    [12:v]scale=760:-2,pad=780:444:10:10:color=white,format=rgba,fade=in:0:24:alpha=1,fade=out:216:24:alpha=1,setpts=PTS+248/TB[m12];\
    [0:v][m1]overlay=90:80:eof_action=pass:enable='between(t,35,45)'[o1];\
    [o1][m2]overlay=1050:90:eof_action=pass:enable='between(t,50,60)'[o2];\
    [o2][m3]overlay=100:70:eof_action=pass:enable='between(t,65,75)'[o3];\
    [o3][m4]overlay=1040:100:eof_action=pass:enable='between(t,85,95)'[o4];\
    [o4][m5]overlay=80:85:eof_action=pass:enable='between(t,105,115)'[o5];\
    [o5][m6]overlay=1060:80:eof_action=pass:enable='between(t,128,138)'[o6];\
    [o6][m7]overlay=90:95:eof_action=pass:enable='between(t,150,160)'[o7];\
    [o7][m8]overlay=1040:75:eof_action=pass:enable='between(t,175,185)'[o8];\
    [o8][m9]overlay=80:90:eof_action=pass:enable='between(t,195,205)'[o9];\
    [o9][m10]overlay=1060:80:eof_action=pass:enable='between(t,214,224)'[o10];\
    [o10][m11]overlay=90:75:eof_action=pass:enable='between(t,232,242)'[o11];\
    [o11][m12]overlay=1040:90:eof_action=pass:enable='between(t,248,258)',subtitles='$ending_dir/credits.ass'[video];\
    [13:a]atrim=0:300,asetpts=PTS-STARTPTS[audio]" \
  -map "[video]" -map "[audio]" -t 300 \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart \
  "$ending_dir/pokemon_korea_ending_credits_final.mp4"
