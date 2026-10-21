// Prints the Plinko theme template PNGs (docs/plinko-theme-kit/page-N.png) into letter landscape PDFs (Build Queue
// 300 and 305): the whole template, one PDF per page, all the ball pages, all the power-up pages. Run by
// scripts/plinko-template.py. Args: page count, ball pages "6,7,...", power-up pages "16,...".
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.dirname(__dirname);
const KIT = path.join(ROOT, 'docs', 'plinko-theme-kit');
const PUB = path.join(ROOT, 'public', 'plinko');
const [n, balls, powers] = [Number(process.argv[2]), process.argv[3].split(',').map(Number), process.argv[4].split(',').map(Number)];
const html = (pages) => `<!doctype html><style>@page{size:11in 8.5in;margin:0}body{margin:0}img{display:block;width:11in;height:8.5in;break-after:page}</style>${pages.map((p) => `<img src="file://${path.join(KIT, `page-${p}.png`)}">`).join('')}`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await b.newPage();
  const out = async (pages, file) => {
    const tmp = path.join(KIT, '.print.html');
    fs.writeFileSync(tmp, html(pages));
    await pg.goto(`file://${tmp}`, { waitUntil: 'load' });
    await pg.pdf({ path: file, width: '11in', height: '8.5in', printBackground: true });
    fs.unlinkSync(tmp);
  };
  fs.mkdirSync(path.join(PUB, 'pages'), { recursive: true });
  const all = Array.from({ length: n }, (_, i) => i + 1);
  await out(all, path.join(KIT, 'plinko-theme-template.pdf'));
  fs.copyFileSync(path.join(KIT, 'plinko-theme-template.pdf'), path.join(PUB, 'plinko-theme-template.pdf'));
  for (const p of all) await out([p], path.join(PUB, 'pages', `page-${p}.pdf`));
  await out(balls, path.join(PUB, 'pages', 'balls.pdf'));
  await out(powers, path.join(PUB, 'pages', 'power-ups.pdf'));
  // Build Queue 319: the kit's how-to as a PDF.
  await pg.goto(`file://${path.join(KIT, 'HOW-TO.html')}`, { waitUntil: 'load' });
  await pg.pdf({ path: path.join(KIT, 'HOW-TO.pdf'), format: 'Letter', printBackground: true });
  await b.close();
})();
