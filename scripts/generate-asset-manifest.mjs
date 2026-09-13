#!/usr/bin/env node
// The World Editor's Asset Directory reads this instead of hitting the
// filesystem at runtime (the browser can't list a directory) — every 3D
// asset under public/world/models, grouped by its immediate folder (the
// same grouping the packs already use: buildings, city, props, ...).
// Regenerated on every build (wired into npm run build) so a newly added
// model file shows up in the editor without a manual step.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

const MODELS_DIR = new URL('../public/world/models', import.meta.url).pathname;
const OUT_FILE = new URL('../public/world/asset-manifest.json', import.meta.url).pathname;
const MODEL_EXTENSIONS = new Set(['.glb', '.gltf']); // .fbx excluded: not loadable by the editor's GLTFLoader (Outdoor_Fall.fbx also has no textures, see build log)

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (MODEL_EXTENSIONS.has(extname(full).toLowerCase())) out.push(full);
  }
  return out;
}

function labelFor(fileBaseName) {
  // "streetLight" / "large_rock" / "neighbor-penny" -> "Street Light" / "Large Rock" / "Neighbor Penny"
  return fileBaseName
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

const files = walk(MODELS_DIR).sort();
const assets = files.map((full) => {
  const rel = relative(new URL('../public', import.meta.url).pathname, full).split('\\').join('/');
  const relParts = rel.split('/'); // world/models/<category>/<file>, or world/models/<file> for the rare uncategorized model
  const category = relParts.length > 3 ? relParts[2] : 'misc';
  const fileBase = basename(full, extname(full));
  return {
    path: `/${rel}`,
    label: labelFor(fileBase),
    category,
  };
});

writeFileSync(OUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), assets }, null, 2));
console.log(`✅ Asset manifest: ${assets.length} models across ${new Set(assets.map((a) => a.category)).size} categories -> public/world/asset-manifest.json`);
