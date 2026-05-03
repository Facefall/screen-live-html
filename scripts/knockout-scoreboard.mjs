/**
 * Builds public/assets/scoreboard.alpha.png from scoreboard.png by knocking out
 * near-black pixels to transparent (soft edge to avoid jaggies).
 * Run: npm run knock-scoreboard
 */
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INPUT = path.join(ROOT, "public", "assets", "scoreboard.png");
const OUTPUT = path.join(ROOT, "public", "assets", "scoreboard.alpha.png");

/** max(R,G,B) below → fully transparent */
const BLACK_IN = 22;
/** max(R,G,B) above → keep original alpha */
const BLACK_OUT = 48;

function processBuffer(png) {
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

      if (lum <= BLACK_IN) {
        aOut = 0;
      } else if (lum < BLACK_OUT) {
        const t = (lum - BLACK_IN) / (BLACK_OUT - BLACK_IN);
        aOut = Math.round(Math.min(aIn, Math.round(aIn * t)));
      }

      data[i + 3] = aOut;
    }
  }
}

const raw = fs.readFileSync(INPUT);
const png = PNG.sync.read(raw);
processBuffer(png);
fs.writeFileSync(OUTPUT, PNG.sync.write(png));
console.log(`[knock-scoreboard] → ${path.relative(ROOT, OUTPUT)}`);
