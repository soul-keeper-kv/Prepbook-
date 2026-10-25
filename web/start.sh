#!/usr/bin/env bash
# Start the app: runs the local server (server.js) and opens it in the browser.
# Keep this window open while using the app; Ctrl+C or closing it stops the server.

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run the app: https://nodejs.org" >&2
  read -r -p "Press Enter to close..."
  exit 1
fi

# The page loads build/app.css, which Tailwind builds from index.css plus the classes
# used in index.html and main.js. After `npm install`, keep rebuilding it while the
# app runs, so a new class shows up on page refresh. Without node_modules the app
# uses the build/app.css already in the folder.
if [ -x node_modules/.bin/tailwindcss ]; then
  node_modules/.bin/tailwindcss -i index.css -o build/app.css --optimize --watch=always &
  css_watcher=$!
  trap 'kill "$css_watcher" 2>/dev/null' EXIT
fi

node server.js --open
