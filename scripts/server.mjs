import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CONFIG_PATH = path.join(ROOT, 'config', 'display.json');
const PORT = Number(process.env.PORT) || 5173;

/** @type {Set<http.ServerResponse>} */
const sseClients = new Set();

/** @type {ReturnType<typeof setTimeout> | undefined} */
let broadcastDebounce;

/**
 * @param {http.ServerResponse} res
 * @param {string} event
 * @param {string | object} data
 */
function sseWrite(res, event, data) {
  const line =
    typeof data === 'string' ? data : JSON.stringify(data);
  const escaped = line.replace(/\n/g, '\ndata: ');
  res.write(`event: ${event}\ndata: ${escaped}\n\n`);
}

/**
 * @param {string} event
 * @param {string | object} payload
 */
function broadcast(event, payload) {
  for (const res of sseClients) {
    try {
      sseWrite(res, event, payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

async function readConfigParsed() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) {
    throw new Error('Config root must be a JSON object');
  }
  const copy = typeof data.copy === 'object' && data.copy !== null ? data.copy : {};
  const images =
    typeof data.images === 'object' && data.images !== null ? data.images : {};
  const safeCopy = Object.fromEntries(
    Object.entries(copy).filter(
      ([, v]) => typeof v === 'string' || typeof v === 'number',
    ),
  );
  const safeImages = Object.fromEntries(
    Object.entries(images).filter(([, v]) => typeof v === 'string'),
  );
  return { copy: safeCopy, images: safeImages };
}

async function safeReadAndBroadcast(reason) {
  try {
    const value = await readConfigParsed();
    broadcast('snapshot', value);
    if (reason) console.log(`[display] snapshot (${reason})`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    broadcast('config-error', { message });
    console.error(`[display] config error: ${message}`);
  }
}

function scheduleBroadcast(reason) {
  clearTimeout(broadcastDebounce);
  broadcastDebounce = setTimeout(() => {
    broadcastDebounce = undefined;
    void safeReadAndBroadcast(reason);
  }, 80);
}

/**
 * @param {string} publicRoot
 * @param {string} pathname
 */
function resolvedPublicPath(publicRoot, pathname) {
  const trimmed = pathname.split('?')[0] ?? '/';
  const rel = trimmed === '/' ? '' : trimmed.replace(/^\/+/, '');
  let target = path.join(publicRoot, rel);
  target = path.resolve(target);
  const rootResolved = path.resolve(publicRoot);
  if (!target.startsWith(rootResolved + path.sep) && target !== rootResolved) {
    return null;
  }
  return target;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleSse(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  if (req.socket.setKeepAlive) req.socket.setKeepAlive(true);

  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
    try {
      res.end();
    } catch {}
  });

  try {
    const value = await readConfigParsed();
    sseWrite(res, 'snapshot', value);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    sseWrite(res, 'config-error', { message });
  }
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleStatic(req, res) {
  const urlObj = new URL(req.url ?? '/', `http://${req.headers.host}`);
  let pathname = urlObj.pathname;
  const filePath = resolvedPublicPath(PUBLIC_DIR, pathname);
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let statPath = filePath;
  try {
    let st = await fs.stat(statPath);
    if (st.isDirectory()) {
      statPath = path.join(statPath, 'index.html');
      st = await fs.stat(statPath);
      if (!st.isFile()) {
        res.writeHead(403).end('Forbidden');
        return;
      }
    } else if (!st.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const buf = await fs.readFile(statPath);
    const ext = path.extname(statPath).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';
    if (req.method === 'HEAD') {
      res
        .writeHead(200, {
          'Content-Type': type,
          'Content-Length': Buffer.byteLength(buf),
        })
        .end();
      return;
    }
    res.writeHead(200, { 'Content-Type': type }).end(buf);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url?.split('?')[0] === '/events') {
    await handleSse(req, res);
    return;
  }
  if (req.method === 'HEAD' && req.url?.split('?')[0] === '/events') {
    res.writeHead(405, { Allow: 'GET' }).end();
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    await handleStatic(req, res);
    return;
  }
  res.writeHead(405, { Allow: 'GET, HEAD' }).end();
});

chokidar
  .watch(CONFIG_PATH, { ignoreInitial: true })
  .on('change', () => scheduleBroadcast('file change'));

server.listen(PORT, () => {
  console.log(
    `[screen-live] http://localhost:${PORT}/ — config ${path.relative(process.cwd(), CONFIG_PATH)}`,
  );
});
