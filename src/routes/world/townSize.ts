import { createContext, useContext } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useStore } from '../../store/store';
import type { WorldObject } from '../../types';

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

const FLAT_RATIO = 6;
const heights = new Map<string, boolean>();
async function isFlat(path: string): Promise<boolean> {
  if (heights.has(path)) return heights.get(path)!;
  try {
    const g = await new GLTFLoader().loadAsync(path);
    const size = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3());
    const flat = size.y <= 0 || Math.max(size.x, size.z) / size.y > FLAT_RATIO;
    heights.set(path, flat);
    return flat;
  } catch {
    heights.set(path, true); // can't measure: leave it alone
    return true;
  }
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
    st.setWorldObjectsDirect(changed);
    st.mergeStyleRow(WORLD_SIZE_OWNER, { on: false, prev: {} });
  }
}
