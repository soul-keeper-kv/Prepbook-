"use strict";

// Builds the debug APK from android/ (run `npm run android:sync` first, or use
// `npm run android:build`, which does both).
//   node scripts/build-android.js            build android/app/build/outputs/apk/debug/app-debug.apk
//   node scripts/build-android.js --install  build, then install on the phone plugged in over USB
//
// Needs JDK 21 and the Android SDK. Uses ANDROID_JAVA_HOME / ANDROID_HOME when set,
// otherwise the default Windows locations: %LOCALAPPDATA%\Android\jdk-21 (or the JDK
// bundled with Android Studio) and %LOCALAPPDATA%\Android\Sdk.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const ANDROID_DIR = path.join(ROOT, "android");
const APK = path.join(ANDROID_DIR, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const LOCAL = process.env.LOCALAPPDATA || "";
const isWindows = process.platform === "win32";

const firstExisting = (dirs) => dirs.find((dir) => dir && fs.existsSync(dir));

const javaHome = firstExisting([
  process.env.ANDROID_JAVA_HOME,
  path.join(LOCAL, "Android", "jdk-21"),
  "C:\\Program Files\\Android\\Android Studio\\jbr",
  process.env.JAVA_HOME,
]);
const sdkDir = firstExisting([
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(LOCAL, "Android", "Sdk"),
]);

if (!sdkDir) {
  console.error("Android SDK not found. Set ANDROID_HOME, or see README.md.");
  process.exit(1);
}
if (!fs.existsSync(ANDROID_DIR)) {
  console.error("android/ is missing. Run `npm run android:sync` first.");
  process.exit(1);
}

const env = { ...process.env, ANDROID_HOME: sdkDir };
if (javaHome) env.JAVA_HOME = javaHome;

// .bat files only run through a shell on Windows, and the shell needs paths with spaces quoted
const quote = (arg) => (isWindows && /\s/.test(arg) ? `"${arg}"` : arg);

function run(cmd, args, cwd) {
  const options = { cwd, env, stdio: "inherit" };
  const result = isWindows
    ? spawnSync([cmd, ...args].map(quote).join(" "), { ...options, shell: true })
    : spawnSync(cmd, args, options);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`JAVA_HOME=${javaHome || "(system default)"}\nANDROID_HOME=${sdkDir}`);
run(path.join(ANDROID_DIR, isWindows ? "gradlew.bat" : "gradlew"), ["assembleDebug"], ANDROID_DIR);
console.log(`\nAPK: ${APK}`);

if (process.argv.includes("--install")) {
  const adb = path.join(sdkDir, "platform-tools", isWindows ? "adb.exe" : "adb");
  // -r keeps the app's data (local progress) when replacing an older install
  run(adb, ["install", "-r", APK], ROOT);
}
