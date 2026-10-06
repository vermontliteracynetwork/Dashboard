import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useStore } from '../store/store';
import { PET_TRICKS, TRICK_REPS_TO_LEARN, trickUnlocked, speakWordFor, nextMilestone, PET_ANSWERS_PER_TRAINING } from '../lib/petCatalog';
import type { PetDef, PetTrick } from '../lib/petCatalog';
import { usePetMove, PET_MOVE_SECONDS, type PetMoveCue } from '../lib/petMoves';
import { usePetTrainingAnswers } from '../lib/petTraining';
import type { StudentPet } from '../types';

// Pet training session (pets review, teacher 2026-10-06: "lets review the
// pet training and general pet functions. lets improve them... lets get
// that feature up and running"). Her original brief: "take a break with
// your pet lets you do pet training interactions" and "I taught it a
// trick". Teaching a trick is a tiny discrete trial, the way real animal
// training (and ABA) works: say the cue, the pet does it, give a treat.
// Three treats and it's learned. It always succeeds (bonding, not a test).
// Learned tricks can be shown off any time, here, at home, and in Town.

function tintedClone(scene: THREE.Object3D, tintColor?: string) {
  const c = cloneSkinned(scene);
  if (tintColor) {
    const color = new THREE.Color(tintColor);
    c.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const tint = (mat: THREE.Material) => {
        const m = mat.clone();
        if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial || m instanceof THREE.MeshBasicMaterial) m.color = color;
        return m;
      };
      child.material = Array.isArray(child.material) ? child.material.map(tint) : tint(child.material);
    });
  }
  return c;
}

// The pet, normalized to 1 unit tall and centered, on a little rug.
function StagePet({ def, tintColor, cue }: { def: PetDef; tintColor?: string; cue: PetMoveCue | null }) {
  const { scene, animations } = useGLTF(def.modelPath);
  const cloned = useMemo(() => tintedClone(scene, tintColor), [scene, tintColor]);
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = size.y > 0 && isFinite(size.y) ? 1 / Math.max(size.y, size.x * 0.8, size.z * 0.8) : 1;
    return { s, x: -center.x * s, y: -box.min.y * s, z: -center.z * s };
  }, [scene]);
  const group = useRef<THREE.Group>(null);
  const move = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    const k = Object.keys(actions).find((n) => n.toLowerCase().includes('idle'));
    const a = k ? actions[k] : undefined;
    a?.reset().play();
    return () => { a?.stop(); };
  }, [actions]);
  usePetMove(move, cue, 1);
  return (
    <group ref={move}>
      <group ref={group} position={[fit.x, fit.y, fit.z]} rotation={[0, 0, 0]}>
        <primitive object={cloned} scale={fit.s} />
      </group>
    </group>
  );
}

type Phase = { trick: PetTrick; reps: number; step: 'cue' | 'doing' | 'treat' } | null;

export default function PetTrainingSession({ pet, def, onClose, onCue }: { pet: StudentPet; def: PetDef; onClose: () => void; onCue?: (kind: string) => void }) {
  const teachTrick = useStore((s) => s.teachTrick);
  const carePet = useStore((s) => s.carePet);
  const answersTowardNext = usePetTrainingAnswers(pet.studentId);
  const [cue, setCue] = useState<PetMoveCue | null>(null);
  const [phase, setPhase] = useState<Phase>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const name = pet.customName || def.name;
  const learned = new Set(pet.tricksLearned ?? []);
  const next = nextMilestone(pet.trainingProgress);

  const perform = (kind: string, say?: string) => {
    setCue({ kind, at: Date.now() });
    onCue?.(kind);
    setBubble(say ?? null);
    if (say) later(() => setBubble(null), PET_MOVE_SECONDS * 1000);
  };

  const sayCue = () => {
    if (!phase || phase.step !== 'cue') return;
    perform(phase.trick.id, phase.trick.id === 'trick-speak' ? speakWordFor(def) : undefined);
    setPhase({ ...phase, step: 'doing' });
    later(() => setPhase((p) => (p ? { ...p, step: 'treat' } : p)), PET_MOVE_SECONDS * 1000);
  };

  const giveTreat = () => {
    if (!phase || phase.step !== 'treat') return;
    const reps = phase.reps + 1;
    setCue({ kind: 'wiggle', at: Date.now() });
    if (reps >= TRICK_REPS_TO_LEARN) {
      teachTrick(pet.id, phase.trick.id);
      carePet(pet.id, 'play');
      setCheer(`🎉 ${name} learned ${phase.trick.label}!`);
      later(() => setCheer(null), 2600);
      setPhase(null);
      return;
    }
    setCheer(['Good job! 🦴', 'Yes! Nice! 🦴', 'Great listening! 🦴'][phase.reps % 3]);
    later(() => setCheer(null), 1200);
    setPhase({ ...phase, reps, step: 'cue' });
  };

  return (
    <div className="pet-train-backdrop" role="dialog" aria-modal="true" aria-label={`Train ${name}`}>
      <div className="pet-train-panel">
        <div className="pet-train-head">
          <h2>🎪 Training time with {name}</h2>
          <button className="btn pet-train-close" onClick={onClose}>✕ Close</button>
        </div>
        <div className="pet-train-body">
          <div className="pet-train-stage">
            <Canvas camera={{ position: [0, 0.75, 2.4], fov: 40 }} onCreated={({ camera }) => camera.lookAt(0, 0.45, 0)}>
              <color attach="background" args={['#fdf3e1']} />
              <ambientLight intensity={1} />
              <directionalLight position={[2, 4, 3]} intensity={1.2} />
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
                <circleGeometry args={[0.9, 40]} />
                <meshStandardMaterial color="#e9c78f" />
              </mesh>
              <Suspense fallback={null}>
                <StagePet def={def} tintColor={pet.tintColor} cue={cue} />
              </Suspense>
            </Canvas>
            {bubble && <div className="pet-train-bubble">{bubble}</div>}
            {cheer && <div className="pet-train-cheer" role="status">{cheer}</div>}
          </div>
          <div className="pet-train-side">
            {phase ? (
              <div className="pet-train-lesson">
                <div className="pet-train-lesson-title">{phase.trick.icon} Teaching {phase.trick.label}</div>
                <div className="pet-train-dots" aria-label={`${phase.reps} of ${TRICK_REPS_TO_LEARN} treats`}>
                  {Array.from({ length: TRICK_REPS_TO_LEARN }, (_, i) => <span key={i} className={i < phase.reps ? 'on' : ''}>🦴</span>)}
                </div>
                {phase.step === 'cue' && (
                  <button className="btn btn-primary pet-train-big" onClick={sayCue}>🗣️ Say "{phase.trick.cue}"</button>
                )}
                {phase.step === 'doing' && <div className="pet-train-wait">Watch {name}...</div>}
                {phase.step === 'treat' && (
                  <button className="btn btn-primary pet-train-big pet-train-treat" onClick={giveTreat}>🦴 Give a treat</button>
                )}
                <button className="btn pet-train-small" onClick={() => setPhase(null)}>Stop for now</button>
              </div>
            ) : (
              <>
                <p className="pet-train-hint">Pick a trick. Tap a trick {name} knows to show it off!</p>
                <div className="pet-train-tricks">
                  {PET_TRICKS.map((t) => {
                    const known = learned.has(t.id);
                    const open = known || trickUnlocked(t, pet.trainingProgress);
                    return (
                      <button
                        key={t.id}
                        className={`pet-train-trick${known ? ' known' : ''}`}
                        disabled={!open}
                        onClick={() => {
                          if (known) perform(t.id, t.id === 'trick-speak' ? speakWordFor(def) : undefined);
                          else setPhase({ trick: t, reps: 0, step: 'cue' });
                        }}
                      >
                        <span className="pet-train-trick-icon">{open ? t.icon : '🔒'}</span>
                        <span>{t.label}</span>
                        <small>{known ? '⭐ Do it!' : open ? 'Teach' : `At ${t.unlockAt} training`}</small>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <div className="pet-train-progress">
              <div>🎓 Training: <strong>{pet.trainingProgress}</strong>{next ? ` (next: ${next.icon} ${next.label} at ${next.threshold})` : ' (all milestones reached!)'}</div>
              <div className="pet-train-how">Every finished assignment = 1 training. Every {PET_ANSWERS_PER_TRAINING} right answers in games and quizzes = 1 training ({answersTowardNext}/{PET_ANSWERS_PER_TRAINING} so far).</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
