// Copies the web app (the single source of truth at the repo root) into www/,
// which is what Capacitor bundles into the native iOS/Android apps. The Vercel
// site keeps serving the root files unchanged.
import { mkdir, copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const OUT = "www";

const FILES = [
  "index.html",
  "styles.css",
  "script.js",
  "multiplayer.js",
  "firebase-config.js",
  "manifest.webmanifest",
];

await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/assets`, { recursive: true });

for (const f of FILES) {
  if (existsSync(f)) await copyFile(f, `${OUT}/${f}`);
}
if (existsSync("assets/logo.svg")) {
  await copyFile("assets/logo.svg", `${OUT}/assets/logo.svg`);
}

console.log(`Built ${OUT}/ — copied ${FILES.length} web files + icon.`);
