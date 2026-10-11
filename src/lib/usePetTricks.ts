import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { setupPoseRig, filterClip, markAnimated, applyPose, trickFrame, trickSeconds, lowestFootY } from './petPoses';
import type { PetMoveCue } from './petMoves';

export const POSE_TRICKS = new Set(['Stand/Stay', 'Sit', 'Come', 'Down', 'Spin', 'Shake a Paw', 'Roll Over', 'Jump', 'Fetch', 'Dance', 'High Five', 'Backflip', 'Speak']);

// Sets up a cloned pet for real trick poses (src/lib/petPoses.ts) and returns its animation clips
// with the IK foot tracks removed, ready for useAnimations.
export function usePoseSetup(model: THREE.Object3D, animations: THREE.AnimationClip[]) {
  return useMemo(() => {
    const { rig, dropTracks } = setupPoseRig(model);
    const clips = animations.map((a) => filterClip(a, dropTracks));
    const idle = clips.find((a) => a.name === 'Idle') ?? clips.find((a) => a.name.toLowerCase().includes('idle')) ?? clips[0] ?? null;
    if (rig) markAnimated(rig, idle);
    const restFoot = rig ? lowestFootY(rig, model) : 0;
    return { rig, clips, restFoot };
  }, [model, animations]);
}

// Plays a trick (by name, from Buff Doge's list) on a walking or resting pet: leg poses on its
// skeleton plus the whole-body part of the move on `group`. `unit` is the pet's size in world units.
export function usePetTricks(setup: ReturnType<typeof usePoseSetup>, model: THREE.Object3D, group: React.RefObject<THREE.Group | null>, cue: PetMoveCue | null | undefined, unit: number, modelScale = 1) {
  const st = useRef({ at: 0, t: 99, name: '' });
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    if (cue && POSE_TRICKS.has(cue.kind) && cue.at !== s.at && Date.now() - cue.at < 1500) { s.at = cue.at; s.t = 0; s.name = cue.kind; }
    const D = trickSeconds(s.name);
    const active = s.t < D;
    if (active) s.t += dt;
    const f = active ? trickFrame(s.name, Math.min(1, s.t / D), s.t) : trickFrame('', 0, 0);
    if (setup.rig) applyPose(setup.rig, f.angles);
    const g = group.current;
    if (!g || !POSE_TRICKS.has(s.name)) return;
    if (!active) { if (s.t < 99) { g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); s.t = 99; } return; }
    let lift = 0;
    // lowestFootY is in the parent group's units, which include the model's own scale.
    if (setup.rig && f.ground) lift = setup.restFoot * modelScale - lowestFootY(setup.rig, model);
    const b = f.body;
    g.position.set(b.px * unit, b.py * unit + lift, b.pz * unit);
    g.rotation.set(b.rx, b.ry, b.rz);
  });
}
