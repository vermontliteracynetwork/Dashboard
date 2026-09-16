// TEMP dev-only measurement tool for Claudia's pet-sizing audit. Not
// imported by the shipped app. Loads every PET_CATALOG_ALL model with the
// exact same GLTFLoader/Box3/SkeletonUtils pipeline PetCompanionModel uses
// in TownSquare.tsx, to get ground-truth raw bounding boxes and validate
// the actual rendered scale end to end. Safe to delete after the audit.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PET_CATALOG_ALL_DEBUG } from './lib/petCatalog';

const PET_SCALE_MIN = 0.05;
const PET_SCALE_MAX = 3;

async function main() {
  const loader = new GLTFLoader();
  const results: any[] = [];
  for (const pet of PET_CATALOG_ALL_DEBUG) {
    const entry: any = { id: pet.id, name: pet.name, category: pet.category, modelPath: pet.modelPath, targetHeight: pet.targetHeight };
    try {
      const gltf = await loader.loadAsync(pet.modelPath);
      const scene = gltf.scene;
      const animations = gltf.animations;

      // Raw box on the ORIGINAL cached scene (exactly what PetCompanionModel measures)
      const rawBox = new THREE.Box3().setFromObject(scene);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      entry.rawSize = { x: +rawSize.x.toFixed(4), y: +rawSize.y.toFixed(4), z: +rawSize.z.toFixed(4) };

      // Root node local transform, to check for a baked non-1 scale that
      // the replace-not-compose primitive scale prop would discard.
      entry.sceneLocalScale = { x: +scene.scale.x.toFixed(5), y: +scene.scale.y.toFixed(5), z: +scene.scale.z.toFixed(5) };
      entry.childRootScales = scene.children.map((c) => ({ name: c.name, scale: { x: +c.scale.x.toFixed(5), y: +c.scale.y.toFixed(5), z: +c.scale.z.toFixed(5) } }));

      const computedScale = (!(rawSize.y > 0) || !isFinite(rawSize.y)) ? 1 : THREE.MathUtils.clamp(pet.targetHeight / rawSize.y, PET_SCALE_MIN, PET_SCALE_MAX);
      entry.computedScale = +computedScale.toFixed(5);
      entry.clampedMin = computedScale === PET_SCALE_MIN;
      entry.clampedMax = computedScale === PET_SCALE_MAX;

      // Now replicate exactly what <primitive object={cloned} scale={scale} />
      // does at runtime: clone via SkeletonUtils, then REPLACE cloned.scale
      // with the computed scalar (R3F's primitive scale prop calls
      // object.scale.set, it does not multiply the existing local scale).
      const cloned = cloneSkinned(scene);
      cloned.scale.setScalar(computedScale);
      cloned.updateMatrixWorld(true);
      const finalBox = new THREE.Box3().setFromObject(cloned);
      const finalSize = finalBox.getSize(new THREE.Vector3());
      entry.actualRenderedHeight = +finalSize.y.toFixed(4);
      entry.actualRenderedWidth = +finalSize.x.toFixed(4);
      entry.matchesTarget = Math.abs(entry.actualRenderedHeight - pet.targetHeight) < 0.005;

      // Sanity check: does measuring the clone directly (unscaled) match
      // measuring the original scene? Rules out "stale/shared object" theory.
      const clonedRawBox = new THREE.Box3().setFromObject(cloneSkinned(scene));
      const clonedRawSize = clonedRawBox.getSize(new THREE.Vector3());
      entry.cloneRawMatchesSceneRaw = Math.abs(clonedRawSize.y - rawSize.y) < 1e-6;

      entry.animationNames = animations.map((a) => a.name);
      entry.hasIdleMatch = animations.some((a) => a.name.toLowerCase().includes('idle'));
      entry.hasWalkMatch = animations.some((a) => a.name.toLowerCase().includes('walk') || a.name.toLowerCase().includes('run'));

      // Texture/material spot check
      const materials: any[] = [];
      scene.traverse((o: any) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            materials.push({
              name: m.name,
              hasMap: !!m.map,
              mapImageSrc: m.map?.image?.src ? String(m.map.image.src).slice(-80) : null,
              mapSize: m.map?.image ? `${m.map.image.width}x${m.map.image.height}` : null,
              hasNormalMap: !!m.normalMap,
              hasVertexColors: !!o.geometry?.attributes?.color,
              color: m.color ? m.color.getHexString() : null,
            });
          }
        }
      });
      entry.materials = materials;
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
    }
    results.push(entry);
  }
  (window as any).__PET_AUDIT_RESULTS__ = results;
  document.title = 'PET_AUDIT_DONE';
}

main();
