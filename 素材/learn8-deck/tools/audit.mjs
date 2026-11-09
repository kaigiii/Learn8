// Deck navigation audit: dead presses, back-navigation fidelity, Q&A branches, rapid presses.
// usage: node tools/audit.mjs [url] [screenshotDir]
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
const npx = `${homedir()}/.npm/_npx`;
const dir = readdirSync(npx).map((d) => `${npx}/${d}/node_modules/puppeteer-core`).find((p) => { try { readdirSync(p); return true; } catch { return false; } });
const puppeteer = createRequire(dir + '/package.json')(dir);
const URL = process.argv[2] || 'http://localhost:3004';
const SHOTS = process.argv[3];
const SETTLE = Number(process.env.SETTLE || 4300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1920, height: 1080 } });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
async function boot() { await p.goto(URL, { waitUntil: 'networkidle2' }); await sleep(3000); await p.focus('hyperframes-slideshow'); }
const fr = () => p.frames().find((f) => f.url().includes('/composition/'));
// what the audience sees: elements with effective opacity > 0.05, rounded box + own text (skips CSS/SMIL loops)
async function sig() {
  return fr().evaluate(() => {
    const vis = [...document.querySelectorAll('#root > .scene-frame')].filter((f) => f.style.visibility === 'visible' && parseFloat(getComputedStyle(f).opacity) > 0.99);
    const f = vis[0];
    if (!f) return { frame: 'NONE', count: vis.length, t: window.__timelines.main.time(), lines: [] };
    const looping = (el) => { for (let e = el; e && e !== f; e = e.parentElement) { if (e.getAnimations && e.getAnimations().some((a) => a.playState === 'running' && a.constructor.name === 'CSSAnimation')) return true; if (e === el && e.querySelector && e.closest('svg') && e.querySelector('animateMotion')) return true; if (e.querySelector && e.querySelector(':scope > animateMotion')) return true; } return false; };
    const effO = (el) => { let o = 1; for (let e = el; e && e !== f.parentElement; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
    const lines = [];
    for (const el of f.querySelectorAll('*')) {
      if (['VIDEO', 'animateMotion', 'defs', 'marker'].includes(el.tagName) || looping(el)) continue;
      const o = effO(el);
      if (o < 0.05) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      const q = (v) => Math.round(v / 6) * 6;
      lines.push(`${el.tagName}#${el.id}.${(el.getAttribute('class') || '').split(' ')[0]} o=${o.toFixed(1)} [${q(r.x)},${q(r.y)},${q(r.width)},${q(r.height)}] ${own}`);
    }
    return { frame: f.id, count: vis.length, t: window.__timelines.main.time(), lines };
  });
}
const diff = (a, c) => {
  const A = new Map(), B = new Map();
  a.lines.forEach((l) => A.set(l, (A.get(l) || 0) + 1));
  c.lines.forEach((l) => B.set(l, (B.get(l) || 0) + 1));
  const out = [];
  for (const [l, n] of A) if ((B.get(l) || 0) < n) out.push(`    only fwd: ${l.slice(0, 160)}`);
  for (const [l, n] of B) if ((A.get(l) || 0) < n) out.push(`    only now: ${l.slice(0, 160)}`);
  return out;
};

await boot();
const fwd = [];
await sleep(SETTLE);
fwd.push(await sig());
const TOTAL = Number(process.env.PRESSES || 39);
for (let i = 1; i <= TOTAL; i++) {
  await p.keyboard.press('ArrowRight');
  await sleep(SETTLE);
  fwd.push(await sig());
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 70 });
}
console.log('== forward');
let dead = 0;
fwd.forEach((s, i) => {
  const same = i > 0 && s.frame === fwd[i - 1].frame && diff(fwd[i - 1], s).length === 0;
  if (same) dead++;
  console.log(`  ${String(i).padStart(2)} t=${s.t.toFixed(1).padStart(5)} ${s.frame.padEnd(16)}${same ? '  !! DEAD PRESS' : ''}${s.count !== 1 ? `  !! ${s.count} visible` : ''}`);
});
console.log('== back (←)');
const byT = new Map(fwd.map((s) => [s.t.toFixed(1), s]));
let backBad = 0;
for (let i = 0; i < TOTAL; i++) {
  await p.keyboard.press('ArrowLeft');
  await sleep(SETTLE);
  const s = await sig();
  const ref = byT.get(s.t.toFixed(1));
  const d = ref ? diff(ref, s) : ['(no forward reference)'];
  if (d.length || s.count !== 1) backBad++;
  console.log(`  ← t=${s.t.toFixed(1).padStart(5)} ${s.frame.padEnd(16)} ${d.length ? `!! ${d.length} differences` : 'matches forward'}`);
  d.slice(0, 3).forEach((x) => console.log(x));
}
console.log('== Q&A');
for (let i = 0; i < TOTAL; i++) { await p.keyboard.press('ArrowRight'); await sleep(60); }
await sleep(9000);
const toc = await sig();
let qaBad = 0;
for (let k = 1; k <= 10; k++) {
  const col = k - 1 >= 5 ? 1 : 0, row = (k - 1) % 5;
  await p.mouse.click(120 + col * 854 + 413, 300 + row * 136 + 58);
  await sleep(1600);
  const a = await sig();
  await p.keyboard.press('ArrowLeft');
  await sleep(1600);
  const back = await sig();
  const ok = a.frame === `scene-qa${k}` && back.frame === 'scene-qa' && diff(toc, back).length === 0;
  if (!ok) qaBad++;
  console.log(`  Q${k}: → ${a.frame} ← ${back.frame} ${ok ? 'ok' : '!!'}`);
}
console.log('== rapid presses');
await boot();
await sleep(SETTLE);
let rapidBad = 0, pos = 0;
for (const burst of [2, 3, 5, 7, 4, 6, 5]) {
  for (let i = 0; i < burst; i++) { await p.keyboard.press('ArrowRight'); await sleep(120); }
  pos += burst;
  await sleep(9000);
  const s = await sig();
  const d = diff(fwd[pos], s);
  if (d.length) rapidBad++;
  console.log(`  after ${String(pos).padStart(2)} presses → ${s.frame} ${d.length ? '!! ' + d.length + ' diffs' : 'matches'}`);
}
console.log(`\nSUMMARY dead=${dead} backMismatch=${backBad} qaBad=${qaBad} rapidBad=${rapidBad} pageErrors=${errors.length}`);
errors.slice(0, 5).forEach((e) => console.log('  pageerror', e));
await b.close();
