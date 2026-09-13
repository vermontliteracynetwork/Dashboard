// Dev-only tool — generates catalog thumbnail PNGs offline via Playwright
// screenshots of this page (dev-thumb.html). Not part of the shipped app
// (Vite's default build only bundles index.html). Kept as a reusable
// maintenance tool: run `node scripts/render-thumbnails.mjs` (with the
// dev server running) after adding a new asset pack to fill in the new
// models' thumbnails — it skips any that already exist.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SIZE = 220;

async function main() {
  const params = new URLSearchParams(location.search);
  const path = params.get('path');
  if (!path) { document.title = 'THUMB_ERROR:no-path'; return; }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE);
  renderer.setPixelRatio(2);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);

  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-3, 2, -3);
  scene.add(fill);

  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(path);
    const object = gltf.scene;
    scene.add(object);

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    // 3/4 angle, standard "product shot" framing — far enough to fit the
    // whole model with a little margin. Root cause of a real bug found
    // testing this: several packs use wildly different native units (the
    // same class of bug WorldEditor.tsx's own auto-scale fix already
    // handles for in-game placement) — a model whose real size is in the
    // hundreds of units put the camera further away than the fixed far-
    // clip plane below, rendering nothing at all. near/far are set AFTER
    // dist is known so they always bracket the actual camera distance,
    // whatever a given model's native scale turns out to be.
    const dist = maxDim * 1.7;
    camera.near = Math.max(dist / 1000, 0.001);
    camera.far = dist * 10;
    camera.updateProjectionMatrix();
    camera.position.set(dist * 0.7, dist * 0.55, dist * 0.7);
    camera.lookAt(0, 0, 0);

    // Some models' textures (as opposed to vertex-colored ones) haven't
    // finished uploading to the GPU the instant loadAsync resolves — a
    // render right away can come out flat/untextured. Compile + a couple
    // of rendered frames with a short delay makes sure textures are
    // actually on the GPU before the real (screenshotted) render.
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    await new Promise((r) => setTimeout(r, 120));
    renderer.render(scene, camera);
    document.title = 'THUMB_READY';
  } catch (err) {
    document.title = 'THUMB_ERROR:' + (err instanceof Error ? err.message : String(err));
  }
}

main();
