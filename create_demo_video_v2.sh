#!/bin/bash
# Create SyncMind demo video v2 - higher quality with better pacing
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
SCREENS="$DIR/demo-screenshots"
OUTPUT="$DIR/syncmind-demo-hd.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Check fonts exist
[ -f "$FONT" ] || FONT="/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
[ -f "$FONT_REG" ] || FONT_REG="/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

# Frame config: image, duration, title line 1, title line 2
declare -a images durations titles subtitles

images=(
  "$SCREENS/fresh-01-main.png"
  "$SCREENS/fresh-02-note-detail.png"
  "$SCREENS/fresh-03-knowledge-graph.png"
  "$SCREENS/fresh-06-agent-chat.png"
  "$SCREENS/fresh-05-ask-ai.png"
  "$SCREENS/fresh-07-new-note.png"
  "$SCREENS/fresh-04-sync-activity.png"
  "$SCREENS/fresh-01-main.png"
)

durations=(12 12 12 10 10 8 8 8)

titles=(
  "SyncMind — AI Research Assistant"
  "AI-Powered Note Analysis"
  "Interactive Knowledge Graph"
  "Mastra Research Agent"
  "Ask Your Research"
  "Create Notes Anywhere"
  "Real-Time Sync Activity"
  "Built with PowerSync"
)

subtitles=(
  "Offline-first notes with AI summaries, tags & connections"
  "Auto-generated summaries, tags, and connected notes"
  "Force-directed graph of AI-discovered relationships"
  "Conversational AI that searches & synthesizes your notes"
  "Natural language Q&A across your entire collection"
  "Save & Analyze — works offline with local SQLite"
  "PowerSync Sync Streams keep devices synchronized"
  "PowerSync + React + Mastra + Claude AI"
)

# Create clips
clips=()
for i in "${!images[@]}"; do
  img="${images[$i]}"
  dur="${durations[$i]}"
  title="${titles[$i]}"
  subtitle="${subtitles[$i]}"
  clip="$SCREENS/clip_v2_$i.mp4"

  echo "Creating clip $i: $title ($dur s)"

  # Semi-transparent gradient bar at bottom with title + subtitle
  ffmpeg -y -loop 1 -i "$img" -t "$dur" \
    -vf "scale=1920:1080,
         drawbox=y=ih-140:w=iw:h=140:color=black@0.75:t=fill,
         drawtext=fontfile=$FONT:text='${title}':fontcolor=white:fontsize=36:x=40:y=h-120,
         drawtext=fontfile=$FONT_REG:text='${subtitle}':fontcolor=0xAAAAFF:fontsize=24:x=40:y=h-72" \
    -c:v libx264 -pix_fmt yuv420p -r 30 -preset fast \
    "$clip" 2>/dev/null

  clips+=("$clip")
done

# Create concat file
concat_file="$SCREENS/concat_v2.txt"
> "$concat_file"
for clip in "${clips[@]}"; do
  echo "file '$clip'" >> "$concat_file"
done

# Concatenate with crossfade would be nice but simple concat is fine
ffmpeg -y -f concat -safe 0 -i "$concat_file" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  "$OUTPUT" 2>/dev/null

# Clean up intermediate files
rm -f "$SCREENS"/clip_v2_*.mp4 "$concat_file"

echo ""
echo "Demo video created: $OUTPUT"
ls -lh "$OUTPUT"
duration=$(ffprobe -v quiet -show_entries format=duration -of compact "$OUTPUT" | grep -o '[0-9.]*$')
echo "Duration: ${duration}s"
