// Screenshot holds of the live deck. usage: node tools/shots.mjs <outDir> <presses> [waitMs] [url]
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
const npx = `${homedir()}/.npm/_npx`;
const dir = readdirSync(npx).map((d) => `${npx}/${d}/node_modules/puppeteer-core`).find((p) => { try { readdirSync(p); return true; } catch { return false; } });
const puppeteer = createRequire(dir + '/package.json')(dir);
const [out, presses, wait = 3800, url = 'http://localhost:3004'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1920, height: 1080 } });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(url, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 3000));
await p.focus('hyperframes-slideshow');
for (let i = 1; i <= Number(presses); i++) {
  await p.keyboard.press('ArrowRight');
  await new Promise((r) => setTimeout(r, Number(wait)));
  await p.screenshot({ path: `${out}/${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 75 });
}
await b.close();
