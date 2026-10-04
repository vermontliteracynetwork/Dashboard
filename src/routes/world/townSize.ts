import { createContext, useContext } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useStore } from '../../store/store';
import type { WorldObject } from '../../types';
import { isFlatModelSize, townSizeFactor } from './WorldObjectRenderer';

// The Town Square size rule (teacher direction 2026-10-04: "everything is
// adjusted to equal 5.00x the player/charcters hight", every asset). When
// it's on, each shared Town Square asset at 1.00x stands 5 times as tall as
// a student's character, and Build Mode's scale slider multiplies on top.
// Saved as the 'world-size' row in style_looks (no new SQL), together with
// every object's previous scale so the teacher can undo it in one tap.

export const WORLD_SIZE_OWNER = 'world-size';
export type WorldSizeRow = { on?: boolean; prev?: Record<string, number> };

export function useTownSizeRule(): boolean {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === WORLD_SIZE_OWNER));
  return !!(row?.look as WorldSizeRow | undefined)?.on;
}

// Provided around the Town Square and Build Mode scenes; the shared object
// renderer reads it so Home Room and the Island are never affected.
export const TownSizeContext = createContext(false);
export const useTownSizeContext = () => useContext(TownSizeContext);

// A model's raw (1.00x, no size rule) bounding-box size, cached per path.
// null when it can't be loaded.
const sizes = new Map<string, Promise<THREE.Vector3 | null>>();
export function measureModel(path: string): Promise<THREE.Vector3 | null> {
  let p = sizes.get(path);
  if (!p) {
    p = new GLTFLoader().loadAsync(path)
      .then((g) => new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3()))
      .catch(() => null);
    sizes.set(path, p);
  }
  return p;
}
async function isFlat(path: string): Promise<boolean> {
  const size = await measureModel(path);
  if (!size) return true; // can't measure: leave it alone
  return isFlatModelSize(size);
}

// Turn the rule on: every non-flat shared object goes to 1.00x (5x the
// character), remembering its old scale. Turning it off puts them back.
export async function setTownSizeRule(on: boolean) {
  const st = useStore.getState();
  const shared = st.worldObjects.filter((o) => !o.studentId);
  const row = (st.styleLooks.find((r) => r.ownerId === WORLD_SIZE_OWNER)?.look ?? {}) as WorldSizeRow;
  if (on) {
    const prev: Record<string, number> = {};
    const flats = await Promise.all(shared.map((o) => isFlat(o.modelPath)));
    const changed: WorldObject[] = [];
    shared.forEach((o, i) => {
      if (flats[i]) return;
      prev[o.id] = o.scale;
      changed.push({ ...o, scale: 1, publishedSnapshot: o.publishedSnapshot ? { ...o.publishedSnapshot, scale: 1 } : o.publishedSnapshot });
    });
    st.setWorldObjectsDirect(changed);
    st.mergeStyleRow(WORLD_SIZE_OWNER, { on: true, prev });
  } else {
    const prev = row.prev ?? {};
    const changed = shared.filter((o) => prev[o.id] !== undefined).map((o) => ({
      ...o,
      scale: prev[o.id],
      publishedSnapshot: o.publishedSnapshot ? { ...o.publishedSnapshot, scale: prev[o.id] } : o.publishedSnapshot,
    }));
    // Objects placed while the rule was on have no old size to go back to.
    // They were sized by the rule (1.00x = 5 characters tall), so they keep
    // exactly that size: their scale absorbs the rule's factor. Before this,
    // they jumped to their raw model size, hundreds of units tall for
    // models authored in centimeters.
    const placedDuring = shared.filter((o) => prev[o.id] === undefined);
    const raw = await Promise.all(placedDuring.map((o) => measureModel(o.modelPath)));
    placedDuring.forEach((o, i) => {
      const f = raw[i] ? townSizeFactor(raw[i]!) : 1;
      if (f === 1) return;
      changed.push({
        ...o,
        scale: o.scale * f,
        publishedSnapshot: o.publishedSnapshot ? { ...o.publishedSnapshot, scale: o.publishedSnapshot.scale * f } : o.publishedSnapshot,
      });
    });
    st.setWorldObjectsDirect(changed);
    st.mergeStyleRow(WORLD_SIZE_OWNER, { on: false, prev: {} });
  }
}
