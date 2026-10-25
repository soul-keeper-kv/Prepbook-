#!/usr/bin/env bash
# Start the app: runs the local server (server.js) and opens it in the browser.
# Keep this window open while using the app; Ctrl+C or closing it stops the server.

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run the app: https://nodejs.org" >&2
  read -r -p "Press Enter to close..."
  exit 1
fi

exec node server.js --open
