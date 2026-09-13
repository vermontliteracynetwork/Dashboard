#!/usr/bin/env node
// Homeplot's zero-weapons rule, enforced automatically instead of relying on
// catching it by eye every time an asset gets wired in (the Fox's sword and
// the Adventurers pack's swords/bows/axes were both caught only by a human
// or Claudia actually looking — this is the "on sight, every time" version
// the plan itself asks for). Scans every real asset path string literal
// referenced from source for a banned weapon word as a whole filename
// token, not a substring, so it flags "sword.glb" but not, say, a filename
// that merely contains "bow" as part of a longer word.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC_DIR = new URL('../src', import.meta.url).pathname;
const MODEL_EXTENSIONS = new Set(['.glb', '.gltf', '.fbx', '.obj']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const ASSET_EXTENSIONS = new Set([...MODEL_EXTENSIONS, ...IMAGE_EXTENSIONS]);
const ASSET_PATH_RE = /'(\/[^']+)'|"(\/[^"]+)"/g;

// Every 3D asset pack this project has actually reviewed ships weapon
// meshes named plainly (the Fox's sword, KayKit Adventurers'
// sword/bow/crossbow/axe/dagger/staff, RPG Tools Bits' axe/knife/pickaxe,
// Goblin Pack's shortsword/shortbow/shiv) — banned outright for any 3D
// model file.
const BANNED_MODEL_WORDS = new Set([
  'sword', 'shortsword', 'axe', 'ax', 'dagger', 'knife', 'shiv', 'pickaxe',
  'bow', 'shortbow', 'crossbow', 'arrow', 'spear', 'staff', 'mace', 'club',
  'gun', 'pistol', 'rifle', 'blade', 'katana', 'sabre', 'saber', 'halberd',
  'lance', 'trident', 'whip', 'nunchaku', 'sling', 'grenade', 'bomb',
  'missile', 'cannon',
]);
// A flat 2D image (UI icons, avatars, emotes) has real, benign uses for
// several of the words above — a directional "arrow" icon, a "bow"
// hair-ribbon, a "staff" as in personnel — so only the unambiguous weapon
// words are banned for images, not the whole model list.
const BANNED_IMAGE_WORDS = new Set([
  'sword', 'shortsword', 'dagger', 'knife', 'shiv', 'pickaxe', 'crossbow',
  'pistol', 'rifle', 'blade', 'katana', 'sabre', 'saber', 'halberd',
  'trident', 'nunchaku', 'grenade', 'bomb', 'missile', 'cannon',
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (['.ts', '.tsx'].includes(extname(full))) out.push(full);
  }
  return out;
}

function tokensOf(path) {
  const filename = path.split('/').pop() ?? '';
  const base = filename.replace(/\.[^.]+$/, '');
  return base.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

const hits = [];
for (const file of walk(SRC_DIR)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    let m;
    ASSET_PATH_RE.lastIndex = 0;
    while ((m = ASSET_PATH_RE.exec(line))) {
      const path = m[1] ?? m[2];
      const ext = extname(path).toLowerCase();
      if (!ASSET_EXTENSIONS.has(ext)) continue;
      const bannedWords = MODEL_EXTENSIONS.has(ext) ? BANNED_MODEL_WORDS : BANNED_IMAGE_WORDS;
      const tokens = tokensOf(path);
      const banned = tokens.find((t) => bannedWords.has(t));
      if (banned) hits.push({ file, line: i + 1, path, banned });
    }
  });
}

if (hits.length > 0) {
  console.error('❌ Zero-weapons check failed — weapon-named asset(s) referenced from source:');
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line} — "${h.path}" (matched "${h.banned}")`);
  }
  console.error('\nEvery asset pack in this project may ship weapon files alongside the parts that');
  console.error('are actually wanted (see docs on the zero-weapons rule) — only the non-weapon parts');
  console.error('ever get imported or referenced from code.');
  process.exit(1);
} else {
  console.log('✅ Zero-weapons check passed — no weapon-named assets referenced from source.');
}
