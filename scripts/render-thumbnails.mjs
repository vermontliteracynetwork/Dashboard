// Batch-renders a real thumbnail PNG for every model in the asset
// manifest via dev-thumb.html (see that file's own comment). Requires the
// Vite dev server already running on :5183 (npm run dev). Re-runnable —
// skips any model that already has a thumbnail, so running this again
// after adding a new asset pack only fills in the new ones. Concurrency
// kept modest (3): this sandbox falls back to software (CPU) WebGL
// rendering, and higher concurrency didn't actually speed things up.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public/world/thumbnails');
mkdirSync(OUT_DIR, { recursive: true });

const manifest = JSON.parse(readFileSync(join(ROOT, 'public/world/asset-manifest.json'), 'utf-8'));
const assets = manifest.assets;

function slugFor(path) {
  return path.replace(/^\/world\/models\//, '').replace(/\.(glb|gltf)$/, '').replace(/[\/\s]/g, '_') + '.png';
}

const CONCURRENCY = 3;
const BASE = 'http://localhost:5183/dev-thumb.html?path=';

let done = 0;
let skipped = 0;
let failed = [];

async function renderOne(page, asset) {
  const outPath = join(OUT_DIR, slugFor(asset.path));
  if (existsSync(outPath)) { skipped++; return; }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(BASE + encodeURIComponent(asset.path), { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForFunction(() => document.title.startsWith('THUMB_'), { timeout: 25000 });
      const title = await page.title();
      if (title.startsWith('THUMB_ERROR')) throw new Error(title);
      await page.locator('canvas').screenshot({ path: outPath });
      // A model that fails to load geometry (a missing texture/decoder
      // dependency, still resolves without throwing) renders a fully
      // blank/transparent canvas — a tiny file size is the reliable
      // signal. Delete it rather than ship a blank image; the catalog UI
      // falls back to the category icon tile when a thumbnail 404s.
      if (statSync(outPath).size < 900) {
        unlinkSync(outPath);
        throw new Error('blank render (likely missing texture/decoder dependency)');
      }
      done++;
      return;
    } catch (err) {
      if (attempt === 1) {
        failed.push({ path: asset.path, error: String(err).slice(0, 200) });
      }
    }
  }
}

async function worker(browser, queue) {
  const page = await browser.newPage({ viewport: { width: 240, height: 240 } });
  while (queue.length) {
    const asset = queue.pop();
    await renderOne(page, asset);
    if ((done + skipped + failed.length) % 50 === 0) {
      console.log(`progress: ${done + skipped + failed.length}/${assets.length} (done=${done} skipped=${skipped} failed=${failed.length})`);
    }
  }
  await page.close();
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true });
const queue = [...assets];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(browser, queue)));
await browser.close();

console.log(`\nDONE. total=${assets.length} rendered=${done} skipped(existing)=${skipped} failed=${failed.length}`);
if (failed.length) {
  console.log('Failures:');
  for (const f of failed) console.log(`  ${f.path} — ${f.error}`);
}
