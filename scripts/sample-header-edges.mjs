/**
 * Sample edge + logo-zone interior averages from header-right-with-logo.png (backdrop matching).
 * Usage: npm run sample-header-edges
 *
 * Uses pixels with alpha≥MIN_A on each edge; skips obvious neon (max(R,G,B)>NEON_MAX).
 */
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import { formatHex } from "culori";
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

const MIN_A = 48;
const NEON_MAX = 220;
const EDGE_BAND = 2;

function edgeAvg(data, width, height, edge) {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;

  const push = (x, y) => {
    const i = (width * y + x) << 2;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < MIN_A) return;
    if (Math.max(r, g, b) > NEON_MAX) return;
    sr += r;
    sg += g;
    sb += b;
    n++;
  };

  if (edge === "top") {
    for (let y = 0; y < Math.min(EDGE_BAND, height); y++) {
      for (let x = 0; x < width; x++) push(x, y);
    }
  } else if (edge === "bottom") {
    for (let y = height - 1; y >= Math.max(0, height - EDGE_BAND); y--) {
      for (let x = 0; x < width; x++) push(x, y);
    }
  } else if (edge === "left") {
    for (let x = 0; x < Math.min(EDGE_BAND, width); x++) {
      for (let y = 0; y < height; y++) push(x, y);
    }
  } else if (edge === "right") {
    for (let x = width - 1; x >= Math.max(0, width - EDGE_BAND); x--) {
      for (let y = 0; y < height; y++) push(x, y);
    }
  }

  if (n === 0) return null;
  const r = Math.round(sr / n);
  const g = Math.round(sg / n);
  const b = Math.round(sb / n);
  return {
    rgb: { r, g, b },
    hex: formatHex({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 }),
    pixelsUsed: n,
  };
}

function rectAvg(data, width, height, x0, y0, x1, y1, step) {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;

  const xStart = Math.max(0, Math.floor(x0));
  const xEnd = Math.min(width, Math.ceil(x1));
  const yStart = Math.max(0, Math.floor(y0));
  const yEnd = Math.min(height, Math.ceil(y1));

  for (let y = yStart; y < yEnd; y += step) {
    for (let x = xStart; x < xEnd; x += step) {
      const i = (width * y + x) << 2;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < MIN_A) continue;
      if (Math.max(r, g, b) > NEON_MAX) continue;
      sr += r;
      sg += g;
      sb += b;
      n++;
    }
  }

  if (n === 0) return null;
  const r = Math.round(sr / n);
  const g = Math.round(sg / n);
  const b = Math.round(sb / n);
  return {
    rgb: { r, g, b },
    hex: formatHex({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 }),
    pixelsUsed: n,
  };
}

/** HUAYU / logo 左侧暗区（排除霓虹），用于整带底色晕染 */
function interiorLogoWash(data, width, height) {
  const x0 = width * 0.035;
  const x1 = width * 0.24;
  const y0 = height * 0.08;
  const y1 = height * 0.92;
  return rectAvg(data, width, height, x0, y0, x1, y1, 10);
}

const raw = fs.readFileSync(inputPath);
const png = PNG.sync.read(raw);
const { width, height, data } = png;

const edges = ["top", "bottom", "left", "right"];
const out = { source: path.relative(ROOT, inputPath), width, height };

for (const e of edges) {
  out[e] = edgeAvg(data, width, height, e);
}

out.interiorLogoWash = interiorLogoWash(data, width, height);

console.log(JSON.stringify(out, null, 2));
