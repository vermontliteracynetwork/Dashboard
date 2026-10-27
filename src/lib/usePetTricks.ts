import { useMemo, useRef } from 'react';
import { pickIdle } from './petClips';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { setupPoseRig, markAnimated, applyPose, trickFrame, trickSeconds, lowestFootY, startFeetFollow, applyFeetFollow, stopFeetFollow, gaitAngles } from './petPoses';
import type { PetMoveCue } from './petMoves';

export const POSE_TRICKS = new Set(['Stand/Stay', 'Sit', 'Come', 'Down', 'Spin', 'Shake a Paw', 'Roll Over', 'Jump', 'Fetch', 'Dance', 'High Five', 'Backflip', 'Speak']);

// Sets up a cloned pet for real trick poses (src/lib/petPoses.ts). Its own animations are left
// exactly as they are.
export function usePoseSetup(model: THREE.Object3D, animations: THREE.AnimationClip[]) {
  return useMemo(() => {
    const { rig } = setupPoseRig(model);
    const clips = animations.filter((a) => a.tracks.length);
    const idleName = pickIdle(clips.map((a) => a.name));
    const idle = clips.find((a) => a.name === idleName) ?? null;
    if (rig) markAnimated(rig, idle);
    const restFoot = rig ? lowestFootY(rig, model) : 0;
    const hasWalk = clips.some((a) => /walk|run|gallop/i.test(a.name));
    return { rig, clips: animations, restFoot, hasWalk };
  }, [model, animations]);
}

// Plays a trick (by name, from Buff Doge's list) on a pet: leg poses on its skeleton plus the
// whole-body part of the move on `group`. Pets with a skeleton but no walk animation also trot
// their legs while `moving` is true. `unit` is the pet's size in world units.
export function usePetTricks(setup: ReturnType<typeof usePoseSetup>, model: THREE.Object3D, group: React.RefObject<THREE.Group | null>, cue: PetMoveCue | null | undefined, unit: number, modelScale = 1, moving?: React.RefObject<boolean>) {
  const st = useRef({ at: 0, t: 99, name: '', posed: false, phase: 0, gait: 0 });
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    const rig = setup.rig;
    if (cue && POSE_TRICKS.has(cue.kind) && cue.at !== s.at && Date.now() - cue.at < 1500) { s.at = cue.at; s.t = 0; s.name = cue.kind; }
    const D = trickSeconds(s.name);
    const active = s.t < D;
    if (active) s.t += dt;
    // A trot for legged pets with no walk animation of their own, easing in and out.
    const wantGait = !!rig && !setup.hasWalk && !!moving?.current && !active;
    s.gait += ((wantGait ? 1 : 0) - s.gait) * Math.min(1, dt * 6);
    if (wantGait) s.phase += dt * 7;
    const f = active ? trickFrame(s.name, Math.min(1, s.t / D), s.t) : trickFrame('', 0, 0);
    const angles = active ? f.angles : s.gait > 0.01 ? gaitAngles(s.phase, s.gait) : {};
    const posing = !!rig && (active || s.gait > 0.01);
    if (rig) {
      if (posing && !s.posed) { startFeetFollow(rig); s.posed = true; }
      if (!posing && s.posed) { stopFeetFollow(rig); s.posed = false; }
      applyPose(rig, angles);
      if (posing) applyFeetFollow(rig);
    }
    const g = group.current;
    if (!g || !POSE_TRICKS.has(s.name)) return;
    // After a trick the body eases back to standing instead of snapping (a snap read as a jerk to one side).
    if (!active) {
      if (s.t < 99) {
        const e = Math.min(1, dt * 8), wrap = (r: number) => Math.atan2(Math.sin(r), Math.cos(r));
        g.position.multiplyScalar(1 - e);
        g.rotation.set(wrap(g.rotation.x) * (1 - e), wrap(g.rotation.y) * (1 - e), wrap(g.rotation.z) * (1 - e));
        if (g.position.lengthSq() < 1e-6 && Math.abs(g.rotation.x) + Math.abs(g.rotation.y) + Math.abs(g.rotation.z) < 1e-3) { g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); s.t = 99; }
      }
      return;
    }
    let lift = 0;
    // lowestFootY is in the parent group's units, which include the model's own scale.
    if (rig && f.ground) lift = setup.restFoot * modelScale - lowestFootY(rig, model);
    const b = f.body;
    g.position.set(b.px * unit, b.py * unit + lift, b.pz * unit);
    g.rotation.set(b.rx, b.ry, b.rz);
  });
}
