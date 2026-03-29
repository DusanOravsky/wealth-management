// Injects the current app version into out/sw.js after next build.
// This ensures sw.js changes on every deploy so the browser detects a new SW.
import { readFileSync, writeFileSync } from "fs";

const { version } = JSON.parse(readFileSync("package.json", "utf-8"));
const swPath = "out/sw.js";

const sw = readFileSync(swPath, "utf-8").replace(
  /const CACHE = "wm-[^"]*"/,
  `const CACHE = "wm-${version}"`
);

writeFileSync(swPath, sw);
console.log(`✓ SW versioned: wm-${version}`);
