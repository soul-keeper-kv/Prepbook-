"use strict";

// Copies the built web app (../web/dist) into www/, the folder Capacitor packs into the APK.
// Run through `npm run build:web`, which builds web/ first (`npm run build` there).
// Everything the page needs is in dist/: Vite bundles the code, the CSS and the data/ JSON.

const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "..", "web", "dist");
const OUT = path.join(__dirname, "..", "www");

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  throw new Error("web/dist is missing; run `npm run build` in web/ first (npm run build:web does it)");
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(DIST, OUT, { recursive: true });
console.log("Copied web/dist to mobile/www/");
