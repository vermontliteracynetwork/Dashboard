import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store/store';
import { StyleCharacter } from './StyleCharacter';
import { defaultLook } from './species';
import type { StyleLook } from './types';

// A student's own Style character as a picture (teacher 2026-10-08: "fix the main screen so they
// are the actual characters designed by the students"). Drawn once in 3D, kept as an image, so a
// screen full of students never holds dozens of 3D views open. Until a student has saved a look,
// the default Style dog shows (teacher 2026-10-08: "remove the old characters everywhere").

const cache = new Map<string, string>();
let busy = 0; const waiting: (() => void)[] = [];
const MAX_AT_ONCE = 3;
const takeSlot = (go: () => void) => { if (busy < MAX_AT_ONCE) { busy++; go(); } else waiting.push(go); };
const freeSlot = () => { busy = Math.max(0, busy - 1); const next = waiting.shift(); if (next) { busy++; next(); } };

// Teacher 2026-10-08: "make sure their full characters are visable and not cut off". The camera
// measures the whole character (ears, hats, wings, tails) and backs up until all of it fits.
function Snap({ onShot }: { onShot: (url: string) => void }) {
  const { gl, camera, scene } = useThree();
  const shot = useRef(onShot); shot.current = onShot;
  const n = useRef(0); const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    n.current++;
    // A few frames so the pose, fur, clothes and patterns are drawn, then fit, then the picture.
    if (n.current === 8) {
      const box = new THREE.Box3();
      scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) box.expandByObject(o); });
      if (!box.isEmpty()) {
        const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
        const cam = camera as THREE.PerspectiveCamera;
        const half = THREE.MathUtils.degToRad(cam.fov / 2);
        const fit = Math.max(size.y / 2, size.x / 2 / cam.aspect) / Math.tan(half);
        const dist = fit * 1.12 + size.z / 2;
        cam.position.set(c.x, c.y + dist * 0.12, c.z + dist);
        cam.lookAt(c);
        cam.updateProjectionMatrix();
      }
    }
    if (n.current < 14) return;
    done.current = true; shot.current(gl.domElement.toDataURL('image/png'));
  });
  return null;
}

const DEFAULT_LOOK = defaultLook('dog');

export function StylePortrait({ studentId, size = 56 }: { studentId: string; size?: number }) {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === studentId));
  const look = useMemo(() => { const l = row?.look as StyleLook | undefined; return l && l.species && l.body && l.outfit ? l : DEFAULT_LOOK; }, [row]);
  const k = JSON.stringify(look);
  const [url, setUrl] = useState<string | null>(() => (k ? cache.get(k) ?? null : null));
  const [drawing, setDrawing] = useState(false);
  useEffect(() => {
    if (!k) return;
    const hit = cache.get(k);
    if (hit) { setUrl(hit); return; }
    let live = true;
    takeSlot(() => { if (live) setDrawing(true); else freeSlot(); });
    return () => { live = false; };
  }, [k]);
  useEffect(() => () => { if (drawing) freeSlot(); }, [drawing]);
  if (url) return <img src={url} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: 'contain', verticalAlign: 'middle' }} />;
  if (!drawing) return <span style={{ display: 'inline-block', width: size, height: size, verticalAlign: 'middle' }} aria-hidden />;
  return (
    <span style={{ display: 'inline-block', width: size, height: size, verticalAlign: 'middle' }} aria-hidden>
      <Canvas style={{ width: size, height: size }} dpr={2} gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }} camera={{ position: [0, 0.85, 2.5], fov: 30 }}>
        <ambientLight intensity={0.85} />
        <hemisphereLight args={['#ffffff', '#f3d6ff', 0.5]} />
        <directionalLight position={[2.5, 4, 3]} intensity={1.2} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#b8d8ff" />
        <Suspense fallback={null}>
          <StyleCharacter look={look} move="idle" reduceMotion />
          <Snap onShot={(shot) => { cache.set(k, shot); setUrl(shot); setDrawing(false); }} />
        </Suspense>
      </Canvas>
    </span>
  );
}
