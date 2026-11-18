// Game Builder's picture and sound library (Build Queue 677, her words 2026-11-18: "all the sounds, assets, sprites
// that have been included in the kids dashboard should be added to the game builder"). Lists every single sprite
// picture (small PNG or GIF, not a sheet or a background) and every sound file under public/, grouped by the pack
// folder it came from, into public/game-builder/library.json. Runs with the build.
import { readdirSync, statSync, openSync, readSync, closeSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = 'public';
const SKIP = new Set(['public/world/models', 'public/game-builder', 'public/literacy', 'public/style', 'public/avatars', 'public/fonts', 'public/icons']);
const IMG = /\.(png|gif)$/i, SND = /\.(mp3|wav|ogg|m4a)$/i;
const pics = new Map(), sounds = new Map();

function size(file) {
  const fd = openSync(file, 'r'); const b = Buffer.alloc(26); readSync(fd, b, 0, 26, 0); closeSync(fd);
  if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString('ascii', 0, 3) === 'GIF') return [b.readUInt16LE(6), b.readUInt16LE(8)];
  return [0, 0];
}
const packOf = (rel) => { const parts = rel.split(sep).slice(0, -1); return parts.slice(0, Math.min(parts.length, 3)).join('/') || 'other'; };
function walk(dir) {
  if (SKIP.has(dir.split(sep).join('/'))) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name); const st = statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    const rel = relative(ROOT, full);
    if (IMG.test(name)) {
      const [w, h] = size(full);
      if (w >= 8 && h >= 8 && w <= 256 && h <= 256 && Math.max(w, h) / Math.min(w, h) <= 2.2) {
        const k = packOf(rel); if (!pics.has(k)) pics.set(k, []); pics.get(k).push('/' + rel.split(sep).join('/'));
      }
    } else if (SND.test(name) && st.size < 3_000_000) {
      const k = packOf(rel); if (!sounds.has(k)) sounds.set(k, []); sounds.get(k).push('/' + rel.split(sep).join('/'));
    }
  }
}
walk(ROOT);
const out = (m) => [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([pack, items]) => ({ pack, items: items.sort() }));
const lib = { pictures: out(pics), sounds: out(sounds) };
writeFileSync('public/game-builder/library.json', JSON.stringify(lib));
console.log(`Game Builder library: ${lib.pictures.reduce((a, p) => a + p.items.length, 0)} pictures in ${lib.pictures.length} packs, ${lib.sounds.reduce((a, p) => a + p.items.length, 0)} sounds in ${lib.sounds.length} packs`);
