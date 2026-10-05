// Real-time screenshot for pages that need to load and run (WebGL, wasm): node _build/shot.mjs URL OUT [waitSeconds] [w] [h]
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [url, out, wait = '30', w = '1280', h = '720'] = process.argv.slice(2);
const CDP = 9400 + Math.floor(Math.random() * 500), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = await mkdtemp(path.join(tmpdir(), 'shot-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--hide-scrollbars',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
let target;
for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = {};
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (pending[m.id]) { pending[m.id](m.result); delete pending[m.id]; } });
const cdp = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
try {
  await cdp('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url });
  await sleep(+wait * 1000);
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  await writeFile(out, Buffer.from(data, 'base64'));
  console.log('wrote', out);
} finally { ws.close(); chrome.kill('SIGKILL'); await sleep(700); await rm(profile, { recursive: true, force: true }); }
