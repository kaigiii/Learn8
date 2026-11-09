// Build the print / PDF edition of the deck (cover + 11 slides + appendix), without touching index.html.
// usage: node tools/print/build.mjs <out.pdf> [--preview <dir>] [--only id,id]
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DECK = path.resolve(HERE, '../../index.html');
const ASSETS = path.resolve(HERE, '../../assets');
const npx = `${homedir()}/.npm/_npx`;
const pdir = readdirSync(npx).map((d) => `${npx}/${d}/node_modules/puppeteer-core`).find((p) => existsSync(p));
const puppeteer = createRequire(pdir + '/package.json')(pdir);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const OUT = args[0];
const PREVIEW = args.includes('--preview') ? args[args.indexOf('--preview') + 1] : null;
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const TMP = path.join(path.dirname(OUT), '.print-tmp');
mkdirSync(TMP, { recursive: true });
if (PREVIEW) mkdirSync(PREVIEW, { recursive: true });

// frame to print for each video (seconds into the clip)
const VIDEO_AT = { 'arena-video': 14.0, 'neuro-v2': 3.0 };

// page plan
const MAIN = ['pain', 'rural', 'mission', 'sdg', 'system', 'paths', 'editor', 'arena', 'neuro', 'model', 'close'];
const APPX = [7, 2, 3, 1, 10, 9, 6, 5, 4, 8]; // appendix order: tech → comparison → Neuro → business → metrics
const pages = [{ kind: 'cover' }, ...MAIN.map((id) => ({ kind: 'main', id })), { kind: 'appx-index' }, ...APPX.map((q, i) => ({ kind: 'appx', q, n: i + 1 }))];
pages.forEach((p, i) => (p.no = i + 1));
const appxStart = pages.findIndex((p) => p.kind === 'appx') + 1;

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'], defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1.5 } });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));

async function boot() {
  await p.goto('file://' + DECK, { waitUntil: 'networkidle2' });
  await p.addStyleTag({ content: readFileSync(path.join(HERE, 'print.css'), 'utf8').replaceAll('__FONTS__', 'file://' + path.join(HERE, 'fonts')) });
  await p.addScriptTag({ content: readFileSync(path.join(HERE, 'fixes.js'), 'utf8') });
  await p.evaluate(() => document.fonts.ready);
  await sleep(1200);
}
const holds = await (async () => {
  await boot();
  return p.evaluate(() => JSON.parse(document.querySelector('script[type="application/hyperframes-slideshow+json"]').textContent).slides.map((s) => ({ id: s.sceneId, n: s.fragments.length })));
})();
function lastHold(id) {
  let acc = 0;
  for (const h of holds) {
    acc += h.n;
    if (h.id === id) return acc - 1;
  }
  throw new Error('no slide ' + id);
}
async function gotoSlide(id) {
  await boot();
  for (let i = 0; i < lastHold(id); i++) {
    await p.keyboard.press('ArrowRight');
    await sleep(110);
  }
  await sleep(id === 'close' || id === 'qa' ? 6000 : 9500);
}

// replace <video> elements in a scene with a still frame (videos do not print)
async function freezeVideos(sceneId) {
  const vids = await p.evaluate((sid) => [...document.querySelectorAll(`#scene-${sid} video`)].map((v) => ({ id: v.id, src: v.getAttribute('src'), t: v.currentTime, op: getComputedStyle(v).opacity })), sceneId);
  for (const v of vids) {
    if (!(v.id in VIDEO_AT) && parseFloat(v.op) < 0.01) {
      await p.evaluate((id) => (document.getElementById(id).style.display = 'none'), v.id);
      continue;
    }
    const t = VIDEO_AT[v.id] ?? v.t;
    const out = path.join(TMP, `${v.id}.png`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', path.resolve(HERE, '../..', v.src), '-frames:v', '1', out]);
    const res = await p.evaluate(
      (id, url, force) => {
        const v = document.getElementById(id);
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = v.style.cssText + ';display:block;position:relative;width:100%;height:auto;object-fit:cover';
        if (force) img.style.opacity = '1';
        v.style.display = 'none';
        v.after(img);
        return new Promise((r) => { if (img.complete) return r(img.naturalWidth); img.onload = () => r(img.naturalWidth); img.onerror = () => r('ERR ' + url); setTimeout(() => r('TIMEOUT'), 8000); });
      },
      v.id,
      'file://' + out,
      v.id in VIDEO_AT
    );
    console.log('  frame', v.id, t.toFixed(2), res);
  }
}

async function output(pg, sceneId) {
  await p.evaluate((sid) => {
    document.querySelectorAll('#root > .scene-frame').forEach((f) => {
      const on = f.id === 'scene-' + sid;
      f.style.visibility = on ? 'visible' : 'hidden';
      f.style.opacity = on ? '1' : '0';
    });
    const r = document.getElementById('root');
    r.style.transform = 'none';
  }, sceneId);
  await p.evaluate(() => document.fonts.ready);
  await sleep(300);
  const name = String(pg.no).padStart(2, '0');
  if (PREVIEW) await p.screenshot({ path: path.join(PREVIEW, `${name}.png`) });
  // raster pages: shadows, glows and masks print exactly as on screen (vector PDF drops their soft masks)
  else await p.screenshot({ path: path.join(TMP, `${name}.jpg`), type: 'jpeg', quality: 90 });
  console.log('page', pg.no, pg.kind, sceneId);
}

const want = (pg) => !ONLY || ONLY.includes(pg.id || pg.kind) || ONLY.includes('q' + pg.q);
for (const pg of pages) {
  if (!want(pg)) continue;
  if (pg.kind === 'main') {
    await gotoSlide(pg.id);
    await p.evaluate((id) => window.__print.fix(id), pg.id);
    await freezeVideos(pg.id);
    await p.evaluate((id, n) => window.__print.pageNo(id, n), pg.id, pg.no);
    await output(pg, pg.id);
  } else if (pg.kind === 'appx') {
    await gotoSlide('qa');
    await p.keyboard.press(String(pg.q % 10));
    await sleep(4500);
    await p.evaluate((q, n) => window.__print.appx(q, n), pg.q, pg.n);
    await p.evaluate((id, n) => window.__print.pageNo(id, n), 'qa' + pg.q, pg.no);
    await output(pg, 'qa' + pg.q);
  } else if (pg.kind === 'appx-index') {
    await gotoSlide('qa');
    await p.evaluate((order, start) => window.__print.appxIndex(order, start), APPX, appxStart);
    await p.evaluate((n) => window.__print.pageNo('qa', n), pg.no);
    await output(pg, 'qa');
  } else if (pg.kind === 'cover') {
    await boot();
    await p.evaluate(() => window.__print.cover());
    await output(pg, 'cover');
  }
}
await b.close();

if (!PREVIEW && !ONLY) {
  const files = pages.map((pg) => path.join(TMP, String(pg.no).padStart(2, '0') + '.jpg'));
  // one JPEG per page, page size 16:9 (1920 x 1080 pt-equivalent scaled to 13.333 x 7.5 in)
  execFileSync('python3', ['-c', `import sys
from PIL import Image
ims=[Image.open(f).convert('RGB') for f in sys.argv[2:]]
ims[0].save(sys.argv[1], save_all=True, append_images=ims[1:], resolution=216.0, quality=90,
  title="Learn8：以無盡內容與個人化學習為核心的 AI 教育生態系", author="范愷鈞、沈晨利、楊詠恩、羅云駿")`, OUT, ...files]);
  console.log('wrote', OUT, files.length, 'pages');
}
if (errors.length) console.log('page errors:', errors.slice(0, 5));
