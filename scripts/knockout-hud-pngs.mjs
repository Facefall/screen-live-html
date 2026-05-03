/**
 * Knock near-black pixels to transparent (same strategy as former scoreboard-only script).
 * Reads originals under public/assets/, writes *.alpha.png alongside.
 *
 * Run: npm run knock-alpha
 */
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "public", "assets");

/** @typedef {{ file: string; out?: string; blackIn?: number; blackOut?: number }} Job */

/** @type {Job[]} */
const JOBS = [
  { file: "scoreboard.png", out: "scoreboard.alpha.png", blackIn: 22, blackOut: 48 },
  { file: "footer.png", out: "footer.alpha.png", blackIn: 22, blackOut: 48 },
  {
    file: "matche-preview-with-no-name.png",
    out: "matche-preview.alpha.png",
    blackIn: 22,
    blackOut: 48,
  },
];

/**
 * @param {import('pngjs').PNG} png
 * @param {number} blackIn max(R,G,B) ≤ → alpha 0
 * @param {number} blackOut max(R,G,B) ≥ → keep alpha
 */
function processBuffer(png, blackIn, blackOut) {
  const { width, height, data } = png;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const aIn = data[i + 3];
      const lum = Math.max(r, g, b);
      let aOut = aIn;

      if (lum <= blackIn) {
        aOut = 0;
      } else if (lum < blackOut) {
        const t = (lum - blackIn) / (blackOut - blackIn);
        aOut = Math.round(Math.min(aIn, Math.round(aIn * t)));
      }

      data[i + 3] = aOut;
    }
  }
}

for (const job of JOBS) {
  const inputPath = path.join(ASSETS, job.file);
  const outName = job.out ?? job.file.replace(/\.png$/i, ".alpha.png");
  const outputPath = path.join(ASSETS, outName);
  const blackIn = job.blackIn ?? 22;
  const blackOut = job.blackOut ?? 48;

  if (!fs.existsSync(inputPath)) {
    console.warn(`[knock-alpha] skip missing: ${job.file}`);
    continue;
  }

  const raw = fs.readFileSync(inputPath);
  const png = PNG.sync.read(raw);
  processBuffer(png, blackIn, blackOut);
  fs.writeFileSync(outputPath, PNG.sync.write(png));
  console.log(`[knock-alpha] ${job.file} → ${path.relative(ROOT, outputPath)}`);
}
