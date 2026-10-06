import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';

// Procedural pet moves (pets review, teacher 2026-10-06: "lets review the
// pet training and general pet functions. lets improve them"). Every pet
// model ships different (or no) animation clips, so tricks and care
// reactions are played as simple transforms on a wrapper group around the
// model: no new 3D assets. Used by the Home Room pet, the training session
// stage, and the Town Square companion.

export type PetMoveKind =
  | 'trick-sit' | 'trick-shake' | 'trick-spin' | 'trick-speak' | 'trick-playdead'
  | 'trick-rollover' | 'trick-dance' | 'trick-highfive'
  | 'hop' | 'wiggle';
export interface PetMoveCue { kind: string; at: number }

export const PET_MOVE_SECONDS = 1.6;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
// Rises over the first quarter, holds, falls over the last quarter.
const hold = (t: number) => (t < 0.25 ? ease(t / 0.25) : t > 0.75 ? ease((1 - t) / 0.25) : 1);

// h: the pet's rendered height in world units (so a hop scales with size).
export function applyPetMove(obj: THREE.Object3D, kind: string, t: number, h: number) {
  resetPetMove(obj);
  const s = Math.sin(Math.PI * t);
  switch (kind) {
    case 'trick-sit':
      obj.rotation.x = -0.45 * hold(t);
      obj.position.y = -0.08 * h * hold(t);
      break;
    case 'trick-shake':
      obj.rotation.z = 0.28 * Math.sin(t * Math.PI * 6) * (1 - t);
      obj.rotation.x = -0.15 * s;
      break;
    case 'trick-spin':
      obj.rotation.y = Math.PI * 2 * ease(t);
      obj.position.y = 0.12 * h * s;
      break;
    case 'trick-speak':
      obj.position.y = 0.22 * h * Math.abs(Math.sin(t * Math.PI * 2));
      obj.rotation.x = -0.12 * Math.abs(Math.sin(t * Math.PI * 2));
      break;
    case 'trick-playdead':
      obj.rotation.z = (Math.PI / 2) * hold(t);
      break;
    case 'trick-rollover':
      obj.rotation.z = Math.PI * 2 * ease(t);
      obj.position.y = 0.25 * h * s;
      break;
    case 'trick-dance': {
      const beat = Math.sin(t * Math.PI * 4);
      obj.rotation.y = 0.6 * beat;
      obj.rotation.z = 0.15 * beat;
      obj.position.y = 0.14 * h * Math.abs(beat);
      break;
    }
    case 'trick-highfive':
      obj.rotation.x = -0.6 * hold(t);
      obj.position.y = 0.2 * h * hold(t);
      break;
    case 'hop':
      obj.position.y = 0.3 * h * Math.abs(Math.sin(t * Math.PI * 2));
      break;
    case 'wiggle':
      obj.rotation.y = 0.35 * Math.sin(t * Math.PI * 6) * (1 - t);
      obj.position.y = 0.1 * h * Math.abs(Math.sin(t * Math.PI * 3));
      break;
  }
}

export function resetPetMove(obj: THREE.Object3D) {
  obj.position.set(0, 0, 0);
  obj.rotation.set(0, 0, 0);
}

// Plays `cue` once on the group each time cue.at changes.
export function usePetMove(ref: React.RefObject<THREE.Group | null>, cue: PetMoveCue | null | undefined, h: number) {
  const started = useRef<{ at: number; t0: number } | null>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    if (cue && started.current?.at !== cue.at && Date.now() - cue.at < 1500) started.current = { at: cue.at, t0: state.clock.elapsedTime };
    if (!cue || !started.current) return;
    const t = (state.clock.elapsedTime - started.current.t0) / PET_MOVE_SECONDS;
    if (t >= 1) {
      if (g.position.y !== 0 || g.rotation.x !== 0 || g.rotation.y !== 0 || g.rotation.z !== 0) resetPetMove(g);
      return;
    }
    applyPetMove(g, cue.kind, Math.max(0, t), h);
  });
}
