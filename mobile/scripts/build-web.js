"use strict";

// Copies the web app from ../web into www/, the folder Capacitor packs into the APK.
// web/ also holds server.js, start.sh, node_modules and progress/, none of which belong
// inside the app, so the files the page needs are listed here. Adding a new file the
// page loads (script, stylesheet, image) means adding it below.
// Run through `npm run build:web`, which rebuilds web/build/app.css first.

const fs = require("fs");
const path = require("path");

const WEB = path.join(__dirname, "..", "..", "web");
const OUT = path.join(__dirname, "..", "www");
const APP_FILES = ["index.html", "main.js", "i18n.js", "build/app.css", "data"];

fs.rmSync(OUT, { recursive: true, force: true });
for (const file of APP_FILES) {
  const from = path.join(WEB, file);
  if (!fs.existsSync(from)) throw new Error(`web/${file} is missing; run npm install in web/ first`);
  fs.cpSync(from, path.join(OUT, file), { recursive: true });
}
console.log(`Copied ${APP_FILES.map((f) => `web/${f}`).join(", ")} to mobile/www/`);
