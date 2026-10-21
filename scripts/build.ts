import { spawnSync } from "node:child_process";
const arg = process.argv[2];
const androidTasks: Record<string, string> = {
  "--android": "build", "--android-setup": "setup", "--emulator": "emulator",
  "--android-verify": "verify",
  "--emulator-restart": "restart",
  "--android-test": "test",
  "--android-record": "record",
  "--android-screenshots": "screenshots",
  "--android-home": "home",
};
if (arg === "--aws-check") { await import("./aws-check.js"); process.exit(0); }
if (arg === "--browser-setup") {
  const result = spawnSync("node_modules/.bin/playwright",["install","chromium"],{stdio:"inherit",env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:".local/playwright"}});
  process.exit(result.status ?? 1);
}
const android = arg && androidTasks[arg];
const result = android
  ? spawnSync("python3", ["scripts/android-tools.py", android], { stdio: "inherit", env: process.env })
  : spawnSync("node_modules/.bin/tsc", ["--noEmit"], { stdio: "inherit" });
process.exit(result.status ?? 1);
