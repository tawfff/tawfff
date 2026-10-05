// Real screenshot of mlx-agent: the real page, a real local model through LM Studio, a real task.
// Serves the page the way the Swift app does (files + /v1,/api proxy to LM Studio), drives headless
// Chrome over CDP, asks a question, and captures the moment the agent waits for command approval.
// Run (LM Studio server up, a model loaded): node _build/agent-shot.mjs ../mlx-agent assets/shot-mlx-agent.png
import http from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [appDir, out, prompt = 'What is using the most disk space in my Downloads folder?'] = process.argv.slice(2);
const LMS = 'http://127.0.0.1:1234', PORT = 8765, CDP = 9333;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/v1/') || u.pathname.startsWith('/api/')) {
    const up = await fetch(LMS + u.pathname + u.search, { method: req.method, headers: { 'content-type': 'application/json' },
      body: req.method === 'GET' ? undefined : req, duplex: 'half' });
    res.writeHead(up.status, { 'content-type': up.headers.get('content-type') || 'application/json' });
    for await (const chunk of up.body) res.write(chunk);
    return res.end();
  }
  if (u.pathname === '/data') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(req.method === 'GET' ? '{}' : ''); }
  const file = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
  const src = file === 'sprite-sheet.png' ? path.join(appDir, 'build/mlx-agent.app/Contents/Resources', file) : path.join(appDir, file);
  try { const body = await readFile(src); res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(PORT);

const profile = await mkdtemp(path.join(tmpdir(), 'shot-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = {};
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (pending[m.id]) { pending[m.id](m.result); delete pending[m.id]; } });
const cdp = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

try {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
  await cdp('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
  for (let i = 0; i < 60 && !(await js(`!!document.querySelector('#model')?.value`)); i++) await sleep(500);
  await js(`(() => { const i = document.querySelector('#input'); i.value = ${JSON.stringify(prompt)}; i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
  let ok = false;
  for (let i = 0; i < 360 && !ok; i++) { await sleep(500); ok = await js(`!!document.querySelector('.approve')`); }
  if (!ok) throw new Error('agent never asked to run a command (3 min)');
  await sleep(800);
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  await writeFile(out, Buffer.from(data, 'base64'));
  console.log('wrote', out, '| command:', await js(`document.querySelector('.approve .cmd').textContent`));
} finally {
  ws.close(); chrome.kill(); server.close(); await sleep(500); await rm(profile, { recursive: true, force: true });
}
