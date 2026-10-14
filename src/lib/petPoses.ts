import * as THREE from 'three';

// Real trick poses on every breed's skeleton (her Pets v2 spec: "Animation tricks are: sit, lay
// down, stand/stay, backflip"; the full list is Buff Doge's table). One set of poses, written once
// for a "canonical" four-legged skeleton, is mapped onto each of the five skeleton types the
// breeds use, so every breed sits, lies down, shakes a paw and gives a high five the same way.
//
// GLTFLoader drops dots from node names (FrontUpperLeg.L loads as FrontUpperLegL), so every
// pattern allows either.
//
// Angles are degrees about the model's own sideways (x) axis, which every pet model shares (head
// toward +z, up +y): a positive angle swings a leg backward or tips the nose down.

export type Canon =
  | 'root' | 'spine' | 'neck' | 'head' | 'tail1' | 'tail2'
  | 'FUL_L' | 'FLL_L' | 'FP_L' | 'FUL_R' | 'FLL_R' | 'FP_R'
  | 'BUL_L' | 'BLL_L' | 'BP_L' | 'BUL_R' | 'BLL_R' | 'BP_R';

interface RigSpec {
  bones: Partial<Record<Canon, RegExp>>;
  // IK foot bones that hang off the armature root: they are moved onto the lower leg so the feet
  // follow the legs, and their animation tracks are dropped.
  reparent?: [RegExp, RegExp][];
  dropTracks?: RegExp;
  // Per skeleton: how much of each canonical bend this skeleton's bone should take.
  adjust?: Partial<Record<Canon, number>>;
}
const side = (s: string, l: 'L' | 'R') => s.replace('%', l);
function legs(fu: string, fl: string, fp: string | null, bu: string, bl: string, bp: string | null, sideFmt: (n: string, l: 'L' | 'R') => string = side) {
  const out: Partial<Record<Canon, RegExp>> = {};
  for (const l of ['L', 'R'] as const) {
    out[`FUL_${l}`] = new RegExp(`^${sideFmt(fu, l)}$`);
    out[`FLL_${l}`] = new RegExp(`^${sideFmt(fl, l)}$`);
    if (fp) out[`FP_${l}`] = new RegExp(`^${sideFmt(fp, l)}$`);
    out[`BUL_${l}`] = new RegExp(`^${sideFmt(bu, l)}$`);
    out[`BLL_${l}`] = new RegExp(`^${sideFmt(bl, l)}$`);
    if (bp) out[`BP_${l}`] = new RegExp(`^${sideFmt(bp, l)}$`);
  }
  return out;
}

const RIGS: { test: RegExp; spec: RigSpec }[] = [
  // Our own skeletons in the Beagle, Poodle, Great Dane and Tabby Cat (auto-quadruped-v1).
  { test: /^FrontPaw\.?L$/, spec: { bones: { root: /^Hips$/, spine: /^Spine$/, neck: /^Neck$/, head: /^Head$/, tail1: /^Tail1$/, tail2: /^Tail2$/, ...legs('FrontUpperLeg\\.?%', 'FrontLowerLeg\\.?%', 'FrontPaw\\.?%', 'BackUpperLeg\\.?%', 'BackLowerLeg\\.?%', 'BackPaw\\.?%') } } },
  // Husky and Shiba Inu (Quaternius animal rig).
  { test: /^FrontShoulder\.?L$/, spec: {
    bones: { root: /^Body$/, spine: /^Torso$/, neck: /^Neck1$/, head: /^Head$/, tail1: /^Tail1$/, tail2: /^Tail3$/, ...legs('FrontUpperLeg\\.?%', 'FrontLowerLeg\\.?%', null, 'BackLeg\\.?%', 'BackUpperLeg\\.?%', 'BackLowerLeg\\.?%') },
    reparent: [[/^IKFrontLeg\.?L$/, /^FrontLowerLeg\.?L$/], [/^IKFrontLeg\.?R$/, /^FrontLowerLeg\.?R$/], [/^IKBackLeg\.?L$/, /^BackLowerLeg\.?L$/], [/^IKBackLeg\.?R$/, /^BackLowerLeg\.?R$/]],
    dropTracks: /^(FF|FFB|IKFrontLeg|IKBackLeg|PoleTarget|PoleTargetBack)\.?[LR]$/,
    adjust: { BLL_L: 0.45, BLL_R: 0.45, BP_L: 0.6, BP_R: 0.6 },
  } },
  // Pug.
  { test: /^FrontUpLeg\.?L$/, spec: {
    bones: { root: /^Body$/, spine: /^Shoulders$/, neck: /^Neck$/, head: /^Head$/, tail1: /^Back$/, ...legs('FrontUpLeg\\.?%', 'FrontLowLeg\\.?%', null, 'BackUpLeg\\.?%', 'BackLowLeg\\.?%', null) },
    reparent: [[/^FrontFoot\.?L$/, /^FrontLowLeg\.?L$/], [/^FrontFoot\.?R$/, /^FrontLowLeg\.?R$/], [/^BackFoot\.?L$/, /^BackLowLeg\.?L$/], [/^BackFoot\.?R$/, /^BackLowLeg\.?R$/]],
    dropTracks: /^(FrontFoot|BackFoot)\.?[LR]$/,
  } },
  // Bicolor, Bengal, Maine Coon and Ragdoll cats (the "Wolf" rig).
  { test: /^Wolf_l_FrontLeg_Hip/, spec: { bones: {
    root: /^Wolf_ROOT/, spine: /^Wolf_Spine_03/, neck: /^Wolf_Neck_01/, head: /^Wolf_Head_Jaw/, tail1: /^Wolf_Tail_01_02/, tail2: /^Wolf_Tail_01_04/,
    ...legs('Wolf_%_FrontLeg_Hip.*', 'Wolf_%_FrontLeg_Knee.*', 'Wolf_%_FrontLeg_Ankle.*', 'Wolf_%_HindLeg_Hip.*', 'Wolf_%_HindLeg_Knee1.*', 'Wolf_%_HindLeg_Ankle.*', (n, l) => n.replace('%', l === 'L' ? 'l' : 'r')),
  } } },
];

export interface PoseRig {
  bones: Partial<Record<Canon, { bone: THREE.Bone; restWorld: THREE.Quaternion; restWorldInv: THREE.Quaternion; restLocal: THREE.Quaternion; animated: boolean }>>;
  feet: THREE.Object3D[];
  adjust: Partial<Record<Canon, number>>;
  // IK foot controls (Husky, Shiba Inu, Pug) and the leg each one follows while the pet is posed.
  follow: { foot: THREE.Object3D; leg: THREE.Object3D; off: THREE.Matrix4 | null }[];
}

// Finds the skeleton type and remembers each mapped bone's resting
// turn relative to the model. Returns null for a model with no matching skeleton (the pet then
// does its tricks as whole-body moves only).
export function setupPoseRig(model: THREE.Object3D): { rig: PoseRig | null; dropTracks?: RegExp } {
  const all: THREE.Object3D[] = [];
  model.traverse((o) => all.push(o));
  const rigDef = RIGS.find((r) => all.some((o) => r.test.test(o.name)));
  if (!rigDef) return { rig: null };
  const find = (re: RegExp) => all.find((o) => re.test(o.name));
  // Teacher 2026-10-12 ("some of them dont move thier legs when walking, tilt thier whole body
  // back when standing"): the IK feet used to be moved onto the legs for good and their
  // animation dropped, which broke the Husky, Shiba Inu and Pug's own walk and idle. The pets now
  // keep their own animations untouched; the feet only follow the legs while a pose is playing.
  const follow: PoseRig['follow'] = [];
  for (const [footRe, legRe] of rigDef.spec.reparent ?? []) {
    const foot = find(footRe), leg = find(legRe);
    if (foot && leg) follow.push({ foot, leg, off: null });
  }
  model.updateMatrixWorld(true);
  const rootInv = new THREE.Quaternion();
  model.getWorldQuaternion(rootInv).invert();
  const bones: PoseRig['bones'] = {};
  for (const [canon, re] of Object.entries(rigDef.spec.bones) as [Canon, RegExp][]) {
    const b = find(re);
    if (!b) continue;
    const w = new THREE.Quaternion();
    b.getWorldQuaternion(w);
    w.premultiply(rootInv);
    bones[canon] = { bone: b as THREE.Bone, restWorld: w, restWorldInv: w.clone().invert(), restLocal: b.quaternion.clone(), animated: false };
  }
  const feet = (['FP_L', 'FP_R', 'BP_L', 'BP_R', 'FLL_L', 'FLL_R', 'BLL_L', 'BLL_R'] as Canon[]).map((c) => bones[c]?.bone).filter(Boolean) as THREE.Object3D[];
  return { rig: { bones, feet, adjust: rigDef.spec.adjust ?? {}, follow } };
}

// Marks which mapped bones the idle animation drives; the rest are reset each frame before posing.
export function markAnimated(rig: PoseRig, clip: THREE.AnimationClip | null) {
  const names = new Set((clip?.tracks ?? []).filter((t) => t.name.endsWith('.quaternion')).map((t) => t.name.split('.')[0]));
  for (const b of Object.values(rig.bones)) if (b) b.animated = names.has(b.bone.name) || names.has(b.bone.uuid);
}

// Removes the IK foot tracks from a clip (they would fight the moved feet).
export function filterClip(clip: THREE.AnimationClip, drop?: RegExp): THREE.AnimationClip {
  if (!drop) return clip;
  const tracks = clip.tracks.filter((t) => !drop.test(t.name.split('.')[0]));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export type PoseAngles = Partial<Record<Canon, number>>;
export interface TrickFrame { angles: PoseAngles; body: { px: number; py: number; pz: number; rx: number; ry: number; rz: number; s: number }; ground: boolean; ball?: { x: number; y: number; z: number } | null }

const SIT: PoseAngles = { root: -35, spine: 5, neck: 20, FUL_L: 35, FUL_R: 35, BUL_L: -55, BUL_R: -55, BLL_L: 105, BLL_R: 105, BP_L: -20, BP_R: -20, tail1: 50 };
const DOWN: PoseAngles = { root: 0, neck: 10, FUL_L: -80, FUL_R: -80, FLL_L: 10, FLL_R: 10, BUL_L: -75, BUL_R: -75, BLL_L: 135, BLL_R: 135, tail1: 30 };
const mix = (a: PoseAngles, b: PoseAngles, t: number): PoseAngles => {
  const out: PoseAngles = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<Canon>) out[k] = (a[k] ?? 0) * (1 - t) + (b[k] ?? 0) * t;
  return out;
};
const scale = (a: PoseAngles, k: number): PoseAngles => mix({}, a, k);
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
// In, hold, out: 0 to 1 to 0 over the trick.
const hold = (u: number, inT = 0.22, outT = 0.82) => (u < inT ? ease(u / inT) : u > outT ? ease((1 - u) / (1 - outT)) : 1);

export const TRICK_SECONDS: Record<string, number> = { Sit: 3, Down: 3.2, 'Shake a Paw': 3, 'High Five': 3, 'Roll Over': 2.4, Backflip: 1.8, Dance: 3, Fetch: 2.6, Speak: 2.2, Spin: 1.8, Jump: 1.6, Come: 2 };
export const trickSeconds = (name: string) => TRICK_SECONDS[name] ?? 1.8;

// Where the pet is u (0 to 1) of the way through a trick.
export function trickFrame(name: string, u: number, w: number): TrickFrame {
  const e = Math.sin(Math.PI * u), h = hold(u);
  const body = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1 };
  let angles: PoseAngles = {};
  let ground = true;
  let ball: TrickFrame['ball'] = null;
  switch (name) {
    case 'Sit': angles = scale(SIT, h); break;
    case 'Down': angles = scale(DOWN, h); break;
    case 'Come': body.pz = 0.3 * e; angles = { FUL_L: 30 * Math.sin(w * 12) * e, FUL_R: -30 * Math.sin(w * 12) * e, BUL_L: -30 * Math.sin(w * 12) * e, BUL_R: 30 * Math.sin(w * 12) * e }; break;
    case 'Spin': body.ry = Math.PI * 2 * ease(u); break;
    case 'Shake a Paw': angles = { ...scale(SIT, h), FUL_L: (35 - 95 * h) + 12 * Math.sin(w * 14) * h, FLL_L: -20 * h, head: -8 * h }; break;
    case 'High Five': angles = { ...scale(SIT, h), FUL_R: 35 - 165 * h, FLL_R: -10 * h, head: -15 * h }; break;
    case 'Roll Over': body.rz = Math.PI * 2 * ease(u); body.py = 0.25 * e; angles = scale(DOWN, e); ground = false; break;
    case 'Jump': body.py = 0.55 * e; angles = { FUL_L: -45 * e, FUL_R: -45 * e, BUL_L: 40 * e, BUL_R: 40 * e }; ground = false; break;
    case 'Dance': angles = { ...scale(SIT, Math.min(1, h * 1.2)), FUL_L: 35 - 80 * h * (0.5 + 0.5 * Math.sin(w * 9)), FUL_R: 35 - 80 * h * (0.5 - 0.5 * Math.sin(w * 9)), head: 12 * Math.sin(w * 9) * h }; body.ry = 0.35 * Math.sin(w * 4.5) * h; break;
    case 'Speak': angles = { neck: -25 * e, head: -15 * e * (0.5 + 0.5 * Math.sin(w * 26)) }; break;
    case 'Backflip': body.rx = -Math.PI * 2 * ease(u); body.py = 0.7 * e; angles = { FUL_L: -60 * e, FUL_R: -60 * e, BUL_L: 60 * e, BUL_R: 60 * e }; ground = false; break;
    case 'Fetch': {
      body.pz = 0.35 * e;
      const b = Math.min(1, u * 1.6);
      ball = { x: 0, y: 0.1 + 0.6 * Math.sin(Math.PI * b), z: 0.9 - 0.55 * b };
      angles = { neck: 25 * e, FUL_L: 30 * Math.sin(w * 12) * e, FUL_R: -30 * Math.sin(w * 12) * e };
      break;
    }
    default: break;
  }
  return { angles, body, ground, ball };
}

const _axis = new THREE.Vector3(1, 0, 0);
const _d = new THREE.Quaternion();
const _q = new THREE.Quaternion();
// Adds the pose on top of whatever the idle animation set this frame.
export function applyPose(rig: PoseRig, angles: PoseAngles) {
  for (const b of Object.values(rig.bones)) if (b && !b.animated) b.bone.quaternion.copy(b.restLocal);
  for (const [canon, deg] of Object.entries(angles) as [Canon, number][]) {
    const b = rig.bones[canon];
    if (!b || !deg) continue;
    _d.setFromAxisAngle(_axis, THREE.MathUtils.degToRad(deg * (rig.adjust[canon] ?? 1)));
    // local delta = restWorld^-1 * D * restWorld: a turn about the model's x axis through this bone.
    _q.copy(b.restWorldInv).multiply(_d).multiply(b.restWorld);
    b.bone.quaternion.multiply(_q);
  }
}

// How far the lowest leg bone has risen off (or sunk below) the floor, in model units.
const _p = new THREE.Vector3();
export function lowestFootY(rig: PoseRig, model: THREE.Object3D): number {
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.parent ? model.parent.matrixWorld : model.matrixWorld).invert();
  let min = Infinity;
  for (const f of rig.feet) { f.getWorldPosition(_p); _p.applyMatrix4(inv); if (_p.y < min) min = _p.y; }
  return min;
}

// While posed, each IK foot keeps the place it had on its leg when the pose began.
const _m = new THREE.Matrix4(), _pi = new THREE.Matrix4(), _pos = new THREE.Vector3(), _rot = new THREE.Quaternion(), _scl = new THREE.Vector3();
export function startFeetFollow(rig: PoseRig) {
  for (const f of rig.follow) { f.leg.updateWorldMatrix(true, false); f.foot.updateWorldMatrix(true, false); f.off = new THREE.Matrix4().copy(f.leg.matrixWorld).invert().multiply(f.foot.matrixWorld); }
}
export function applyFeetFollow(rig: PoseRig) {
  for (const f of rig.follow) {
    if (!f.off || !f.foot.parent) continue;
    f.leg.updateWorldMatrix(true, false);
    _m.copy(f.leg.matrixWorld).multiply(f.off);
    f.foot.parent.updateWorldMatrix(true, false);
    _pi.copy(f.foot.parent.matrixWorld).invert();
    _m.premultiply(_pi).decompose(_pos, _rot, _scl);
    f.foot.position.copy(_pos); f.foot.quaternion.copy(_rot);
  }
}
export function stopFeetFollow(rig: PoseRig) { for (const f of rig.follow) f.off = null; }

// A walking step for pets whose model has no walk animation: legs swing in a trot.
export function gaitAngles(phase: number, amount = 1): PoseAngles {
  const s = Math.sin(phase), c = Math.cos(phase);
  // Gentler steps (teacher 2026-10-14: "make sure pets learning new skills dont change animations drastically").
  const a = 18 * amount, k = 20 * amount;
  return {
    FUL_L: -a * s, FUL_R: a * s, BUL_L: a * s, BUL_R: -a * s,
    FLL_L: k * Math.max(0, c), FLL_R: k * Math.max(0, -c), BLL_L: k * 0.6 * Math.max(0, -c), BLL_R: k * 0.6 * Math.max(0, c),
    head: 4 * Math.sin(phase * 2) * amount, tail1: 10 * Math.sin(phase) * amount,
  };
}
