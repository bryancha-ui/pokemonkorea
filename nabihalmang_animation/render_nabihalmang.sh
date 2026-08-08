#!/usr/bin/env bash
set -euo pipefail

scene_dir="$(cd "$(dirname "$0")" && pwd)"
clip_a="$scene_dir/generated/clip01_restraint_shatter.mp4"
clip_b="$scene_dir/generated/clip02_wing_reveal.mp4"
audio="$scene_dir/audio/nabihalmang_entrance_audio_master.m4a"
ryeo="$scene_dir/reference/shot_reaction_ryeo.png"
protagonist="$scene_dir/reference/shot_reaction_protagonist.png"
output="$scene_dir/nabihalmang_jeju_crater_entrance_final.mp4"

for required in "$clip_a" "$clip_b" "$audio" "$ryeo" "$protagonist"; do
  if [[ ! -f "$required" ]]; then
    echo "Missing required input: $required" >&2
    exit 1
  fi
done

ffmpeg -y \
  -i "$clip_a" \
  -i "$clip_b" \
  -i "$audio" \
  -loop 1 -framerate 30 -t 1.25 -i "$ryeo" \
  -loop 1 -framerate 30 -t 1.666667 -i "$protagonist" \
  -filter_complex "\
    [0:v]trim=0:15,setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,format=yuv420p[v0];\
    [1:v]trim=start=0:end=6.083333,setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,format=yuv420p[v1a];\
    [3:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.00035,1.018)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=1.25,setpts=PTS-STARTPTS,format=yuv420p[ryeo];\
    [4:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.0003,1.018)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=1.666667,setpts=PTS-STARTPTS,format=yuv420p[hero];\
    [1:v]trim=start=9:end=15,setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,format=yuv420p[v1b];\
    [v0][v1a][ryeo][hero][v1b]concat=n=5:v=1:a=0,tpad=stop_mode=clone:stop_duration=1,fade=t=out:st=30:d=1[video];\
    [2:a]atrim=0:30,asetpts=PTS-STARTPTS,apad=pad_dur=1,atrim=0:31[audio]" \
  -map "[video]" -map "[audio]" -t 31 \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -movflags +faststart \
  "$output"

echo "$output"
