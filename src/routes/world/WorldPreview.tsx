import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, useGLTF } from '@react-three/drei';
import { Link } from 'react-router-dom';

// Phase 0 engineering spike only — proves the render pipeline (Three.js via
// react-three-fiber, glTF loading, camera controls) works inside this app's
// existing Vite/React stack before any real room-building or gameplay gets
// wired to it. Not linked from student/teacher navigation yet; reachable
// directly at /world-preview for testing during the build.
function Fox() {
  const { scene } = useGLTF('/world/models/fox.glb');
  return <primitive object={scene} scale={1} position={[0, 0, 0]} />;
}

export default function WorldPreview() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#cfe3d8' }}>
      <Link
        to="/"
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          background: 'white',
          padding: '8px 14px',
          borderRadius: 10,
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 700,
          textDecoration: 'none',
          color: '#1f4238',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        ← Back
      </Link>
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 10,
          background: 'rgba(255,255,255,0.9)',
          padding: '8px 14px',
          borderRadius: 10,
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.85rem',
          color: '#1f4238',
          maxWidth: 320,
        }}
      >
        Phase 0 render-pipeline spike — drag to orbit, scroll to zoom. Not the real Home room yet.
      </div>
      <Canvas camera={{ position: [3, 2.5, 4], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
        <Suspense fallback={null}>
          <Fox />
          <Environment preset="park" />
        </Suspense>
        <Grid args={[20, 20]} cellColor="#9fb8ac" sectionColor="#6b8f7c" fadeDistance={20} />
        <OrbitControls target={[0, 0.5, 0]} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}
