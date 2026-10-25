#!/usr/bin/env bash
# Start the app on the PC: build it, run the local server (server/serve.ts) and open the browser.
# Keep this window open while using the app; Ctrl+C or closing it stops the server.
# While editing code or data/, `npm run dev` is quicker: it reloads the page on every save.

cd "$(dirname "$0")" || exit 1

fail() {
  echo "$1" >&2
  read -r -p "Press Enter to close..."
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js 22.18 or newer is required: https://nodejs.org"
# Node runs server/serve.ts directly; that needs type stripping (Node 22.18+)
node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 18) ? 0 : 1)' \
  || fail "Node.js $(node -v) is too old: 22.18 or newer is required (https://nodejs.org)"

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only)..."
  npm ci --no-audit --no-fund || fail "npm ci failed."
fi

# Rebuild every time, so changes to the code or to data/ always show up
npx vite build --logLevel warn || fail "Build failed (see the error above)."

exec node server/serve.ts --open
