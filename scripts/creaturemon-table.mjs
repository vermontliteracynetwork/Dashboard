// The running table of every Creaturemon creature (Build Queue 705, her words: "there should be a running table of
// all information of our new monsters"). Reads src/games/creaturemon/roster.json (the one place the roster lives)
// and writes docs/CREATUREMON.md, plus docs/creaturemon-table.pdf with every creature's picture when Playwright is
// available. Run after any roster change: node scripts/creaturemon-table.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const roster = JSON.parse(fs.readFileSync(path.join(root, 'src/games/creaturemon/roster.json'), 'utf8'));
const HAB = { meadow: 'Sunny Meadow', forest: 'Whisper Woods', lake: 'Splash Lake', snow: 'Frost Ridge', night: 'Night Grove', ember: 'Ember Rocks' };
const KIND = { shot: 'shoots across the island', dash: 'dashes forward', burst: 'bursts all around it', slam: 'jumps and slams down' };
const SRC = { ec: 'Evolving Creatures (MEKAI GAMES)', mp: 'Pixel Art Monster Evolution Pack', pm: 'PoMoRe (her upload)' };
const lines = roster.lines;
const forms = lines.flatMap((l) => l.forms.map((f) => ({ ...f, l })));
const lv = (k, level) => Math.round(k * (1 + (level - 1) * 0.04));

let md = `# Creaturemon: the running creature table\n\n`;
md += `Every creature in Creaturemon, one row per evolution (every evolution has its own card). Kept up to date from \`src/games/creaturemon/roster.json\` by \`node scripts/creaturemon-table.mjs\`; the PDF version with pictures is \`docs/creaturemon-table.pdf\`.\n\n`;
md += `**${forms.length} creatures in ${lines.length} evolution lines.** Names are built from each creature's body shape, in the style of the classic creature games (two words blended, the way the classics name theirs). Stats are at level 1; every level adds 4%.\n\n`;
md += `Types and what they beat (special moves only; a strong hit does 1.5 times the damage, a weak one 0.7): Fire beats Leaf and Frost. Water beats Fire and Stone. Leaf beats Water and Stone. Frost beats Leaf and Sky. Stone beats Fire and Spark. Sky beats Leaf and Spark. Spark beats Water and Sky. Shadow and Light beat each other.\n\n`;
md += `| # | Name | Line | Stage | Type | Lives in | Name comes from | What it is like | HP | ATK | DEF | SPD | Special move | Evolves | Art |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
forms.forEach((f, i) => {
  const s = f.stats; const nx = f.l.forms[f.stage];
  md += `| ${i + 1} | **${f.name}** | ${f.l.forms[0].name} line | ${f.stage} of ${f.l.forms.length} | ${f.l.type} | ${HAB[f.l.habitat]} | ${f.nameFrom} | ${f.desc} | ${s.hp} | ${s.atk} | ${s.def} | ${s.spd} | ${f.l.special.name} (${KIND[f.l.special.kind]}) | ${nx ? `into ${nx.name} at Lv ${f.evolvesAt}` : 'Final form'} | ${SRC[f.l.src.pack]} |\n`;
});
md += `\n## Evolution lines\n\n`;
for (const l of lines) md += `- **${l.type}, ${HAB[l.habitat]}:** ${l.forms.map((f, i) => (i ? ` (Lv ${l.forms[i - 1].evolvesAt}) ${f.name}` : f.name)).join(' ▸')}\n`;
md += `\n## Art credits\n\nCreatures: Evolving Creatures by MEKAI GAMES; Pixel Art Monster Evolution Pack (free); her PoMoRe pack. Cards: NPC Quest TCG Cards (CraftPix) and Pixel Cards & Deckbuilder Kit Lite by Willosuna. World: Pixel Assets JAN2022 by Stamper; Pixel Skies by Digital Moons (https://digitalmoons.itch.io/pixel-skies, credit required); the Pixel Lorebook font from the 3D Pixel Art Kit Lite by Julius Schmidt.\n`;
fs.writeFileSync(path.join(root, 'docs/CREATUREMON.md'), md);
console.log('wrote docs/CREATUREMON.md', forms.length, 'creatures');

// The PDF: the same table with each creature's picture.
let pw = null;
try { pw = createRequire(import.meta.url)('playwright'); } catch { console.log('no playwright, skipped the PDF'); }
if (pw) {
  const COLOR = { Fire: '#e8602c', Water: '#2f8fe0', Leaf: '#4caf50', Frost: '#8fd8f0', Shadow: '#6b4fa0', Stone: '#a08050', Light: '#f2d45c', Spark: '#f2a33a', Sky: '#7fb6e8' };
  const img = (id) => `data:image/png;base64,${fs.readFileSync(path.join(root, `public/games/creaturemon/forms/${id}.png`)).toString('base64')}`;
  const font = `data:font/ttf;base64,${fs.readFileSync(path.join(root, 'public/games/creaturemon/PixelLorebook.ttf')).toString('base64')}`;
  const rows = forms.map((f, i) => {
    const nx = f.l.forms[f.stage]; const s = f.stats;
    return `<tr><td>${i + 1}</td><td class="pic" style="background:${COLOR[f.l.type]}33"><img src="${img(f.id)}" style="height:${f.sprite.fh * Math.max(1, Math.floor(66 / f.sprite.fh))}px"></td><td><b class="nm">${f.name}</b><br><span class="ty" style="background:${COLOR[f.l.type]}">${f.l.type}</span> Stage ${f.stage} of ${f.l.forms.length}</td><td>${f.nameFrom}</td><td>${f.desc}</td><td>${HAB[f.l.habitat]}</td><td class="n">${s.hp} / ${s.atk} / ${s.def} / ${s.spd}<br><small>Lv 10: ${lv(s.hp, 10)} / ${lv(s.atk, 10)} / ${lv(s.def, 10)} / ${lv(s.spd, 10)}</small></td><td>${f.l.special.name}<br><small>${KIND[f.l.special.kind]}</small></td><td>${nx ? `${nx.name} at Lv ${f.evolvesAt}` : 'Final form'}</td></tr>`;
  }).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:PL;src:url(${font})}body{font:11px/1.3 system-ui,sans-serif;margin:24px;color:#222}h1{font-family:PL;font-size:30px;margin:0 0 4px}p{margin:4px 0 10px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;vertical-align:middle;text-align:left}th{background:#2b1f5a;color:#fff}tr{page-break-inside:avoid}.pic{width:78px;text-align:center}.pic img{image-rendering:pixelated;max-width:76px;object-fit:contain}.nm{font-family:PL;font-size:15px}.ty{color:#fff;border-radius:4px;padding:0 5px;font-weight:800}.n{white-space:nowrap}</style>
<h1>Creaturemon: every creature</h1><p>${forms.length} creatures in ${lines.length} evolution lines, one row per evolution (each has its own card). Stats: Health / Attack / Defense / Speed at level 1, then at level 10. Updated ${new Date().toISOString().slice(0, 10)}.</p>
<table><tr><th>#</th><th>Picture</th><th>Name</th><th>Name comes from</th><th>What it is like</th><th>Lives in</th><th>Stats</th><th>Special move</th><th>Evolves</th></tr>${rows}</table>`;
  const b = await pw.chromium.launch(); const pg = await b.newPage(); await pg.setContent(html, { waitUntil: 'load' });
  await pg.pdf({ path: path.join(root, 'docs/creaturemon-table.pdf'), format: 'Letter', landscape: true, printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
  await b.close(); console.log('wrote docs/creaturemon-table.pdf');
}
