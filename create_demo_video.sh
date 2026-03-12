#!/bin/bash
# Create SyncMind demo video from screenshots with title overlays
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMES="$DIR/demo-frames"
OUTPUT="$DIR/syncmind-demo-hd.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

# Frame duration in seconds
DUR=5

# Define titles for each frame
titles=(
  "SyncMind - AI Research Assistant\nOffline-first notes with AI-powered analysis"
  "Note Detail View\nAI Summary, Tags, and Connected Notes"
  "Interactive Knowledge Graph\n7 notes with AI-discovered connections"
  "Real-Time Sync Activity\nPowerSync keeps devices synchronized"
  "Mastra Research Agent\nConversational AI that searches your notes"
  "Create New Notes\nSave & Analyze with Claude AI"
)

# Create individual clips with text overlays
clips=()
i=0
for img in "$FRAMES"/0*.png; do
  base=$(basename "$img" .png)
  clip="$FRAMES/clip_${base}.mp4"
  title="${titles[$i]}"

  # Create clip with semi-transparent bottom bar + white text
  ffmpeg -y -loop 1 -i "$img" -t $DUR \
    -vf "scale=1920:1080,
         drawbox=y=ih-120:w=iw:h=120:color=black@0.7:t=fill,
         drawtext=fontfile=$FONT:text='${title}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=h-100:line_spacing=10" \
    -c:v libx264 -pix_fmt yuv420p -r 30 \
    "$clip" 2>/dev/null

  clips+=("$clip")
  ((i++))
done

# Create concat file
concat_file="$FRAMES/concat.txt"
> "$concat_file"
for clip in "${clips[@]}"; do
  echo "file '$clip'" >> "$concat_file"
done

# Concatenate all clips
ffmpeg -y -f concat -safe 0 -i "$concat_file" \
  -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p \
  "$OUTPUT" 2>/dev/null

# Clean up intermediate files
rm -f "$FRAMES"/clip_*.mp4 "$concat_file"

echo "Demo video created: $OUTPUT"
ls -lh "$OUTPUT"
