/**
 * Phase A: sample average dark-background colour from HUD PNG (no neon).
 * Usage: npm run sample-hud-dark
 *
 * Method: scan pixels with max(R,G,B) in [8, 72] and alpha>200 (skip glow/logo).
 * Asset: public/assets/header-right-with-logo.png (override via argv).
 */
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import { converter, formatHex } from "culori";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_INPUT = path.join(
  ROOT,
  "public",
  "assets",
  "header-right-with-logo.png",
);

const inputPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : DEFAULT_INPUT;

const STEP = 6;
const MIN_M = 8;
const MAX_M = 72;
const MIN_A = 200;

const raw = fs.readFileSync(inputPath);
const png = PNG.sync.read(raw);
const { width, height, data } = png;

let sr = 0;
let sg = 0;
let sb = 0;
let n = 0;

for (let y = 0; y < height; y += STEP) {
  for (let x = 0; x < width; x += STEP) {
    const i = (width * y + x) << 2;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const m = Math.max(r, g, b);
    if (a >= MIN_A && m >= MIN_M && m <= MAX_M) {
      sr += r;
      sg += g;
      sb += b;
      n++;
    }
  }
}

if (n < 50) {
  console.warn(
    "[sample-hud-dark] few pixels matched; relax MAX_M or check asset path.",
  );
}

if (n === 0) {
  console.error("[sample-hud-dark] no pixels sampled.");
  process.exit(1);
}

const r = Math.round(sr / n);
const g = Math.round(sg / n);
const b = Math.round(sb / n);
const hex = formatHex({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
const toOklch = converter("oklch");
const o = toOklch({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });

console.log(JSON.stringify({
  source: path.relative(ROOT, inputPath),
  pixelsUsed: n,
  rgb: { r, g, b },
  hex,
  oklch: o
    ? {
        l: Number(o.l?.toFixed(4)),
        c: Number(o.c?.toFixed(4)),
        h: o.h == null ? null : Number(o.h.toFixed(2)),
      }
    : null,
}, null, 2));
