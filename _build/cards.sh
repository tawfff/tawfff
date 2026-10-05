#!/bin/bash
# Rebuilds every card in assets/ from live sites and the HTML in _build/. Run: _build/cards.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p _build/shots
enc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$1"; }
clear() { CHROME_FLAGS=--default-background-color=00000000 _build/render.sh "$@"; }
card() { # name shot label title line [fit] [bg]
  clear _build/card.html "assets/card-$1.png" 800 640 "?img=$(enc "shots/$2")&label=$(enc "$3")&title=$(enc "$4")&line=$(enc "$5")&fit=${6:-cover}&bg=$(enc "${7:-}")"
}
_build/render.sh _build/proof-of-player.html _build/shots/proof-of-player.png 1600 980
_build/render.sh https://laqtaa.app _build/shots/laqtaa.png 1440 900
VT=9000 _build/render.sh https://gvnr.io _build/shots/gvnr.png 1440 900
_build/render.sh /Users/tawfik/mlx-agent/build/mlx-agent.app/Contents/Resources/index.html _build/shots/mlx-agent-empty.png 1280 800
_build/render.sh _build/shellguard-shot.html _build/shots/shellguard.png 800 440
card mlx-agent mlx-agent-empty.png "AI agent · Swift · local models" "mlx-agent" "On-device AI agent for Apple Silicon. Searches, reads and runs commands you approve."
card shellguard shellguard.png "Fine-tune · work in progress" "shellguard-lora" "Teaching Qwen3.8 27B a team command policy, without putting the policy in the prompt."
card laqtaa laqtaa.png "Consumer app · live" "Laqtaa" "Guests scan one QR and every photo lands in one shared album. English and Arabic."
card proof-of-player proof-of-player.png "Concept · identity for games" "Proof of Player" "Passkey sign-in and a verified-player pass, so a ban follows the person." contain "#0A0A0A"
card gvnr gvnr.png "AI agents · Instruxi" "GVNR" "A governor for AI agents: every action is allowed, rewritten, asked or denied before it runs."
names='[["Meta","XR production lead"],["PUBG","blockchain lead"],["Binance","head of devrel"],["OKX","head of growth"],["Coinbase","CRM engineer"],["Expo 2020","3D digital twin"]]'
clear _build/card.html assets/card-receipts.png 800 640 "?kind=receipts&names=$(enc "$names")"
