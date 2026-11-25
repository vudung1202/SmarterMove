#!/bin/sh
# Chụp prototype: tools/shoot.sh <tên> <hash> <rộng> <cao>
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=4000 \
  --window-size="$3,$4" --screenshot="$(pwd)/.taste-skill/shots/$1.png" \
  "http://localhost:4173/index.html$2" >/dev/null 2>&1
echo ".taste-skill/shots/$1.png"
