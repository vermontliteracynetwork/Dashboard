import { useEffect, useMemo, useRef, useState } from 'react';
import { Wheel } from 'spin-wheel';
import { useStore } from '../store/store';
import { petDefById } from '../lib/petCatalog';
import { TILE_KINDS, type TileKind } from '../lib/matchThree';
import { TILE_ART } from '../lib/bakeryTiles';
import { playWheelSpin, playAchievementChime } from '../lib/chime';

// Direct teacher instruction: "when the game is completed, the student
// should have a wheel spin (same as daily and bonus wheels) with only
// these bakery treat options. players can eat these and they can give
// them to their pets. if they give them to their pets, their food bar
// will increase one notch." Same spin-wheel library and visual shape as
// DailySpinWheel.tsx, trimmed down: no cash economy, every segment is
// just one of the six Bakery match-3 treats, picked with equal odds.
interface Props {
  studentId: string;
  onClose: () => void;
}

const SPIN_DURATION_MS = 2600;
const SEGMENT_COLORS = ['#f7c948', '#4ade80', '#60a5fa', '#f472b6', '#c084fc', '#fb923c'];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function PetThumb({ modelPath, name }: { modelPath: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = '/world/thumbnails/' + modelPath.replace(/^\/world\/models\//, '').replace(/\.(glb|gltf)$/, '').replace(/[/\s]/g, '_') + '.png';
  if (failed) return <span style={{ fontSize: '1.8rem' }}>🐾</span>;
  return <img src={src} alt={name} onError={() => setFailed(true)} style={{ width: 40, height: 40, objectFit: 'contain' }} />;
}

export default function BakeryTreatWheel({ studentId, onClose }: Props) {
  const students = useStore((s) => s.students);
  const pets = useStore((s) => s.pets);
  const carePet = useStore((s) => s.carePet);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<InstanceType<typeof Wheel> | null>(null);
  const [wheelReady, setWheelReady] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<TileKind | null>(null);
  const [gaveToPetId, setGaveToPetId] = useState<string | null>(null);

  const student = students.find((s) => s.id === studentId);
  const myPets = useMemo(() => pets.filter((p) => p.studentId === studentId), [pets, studentId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const images = await Promise.all(TILE_KINDS.map((kind) => loadImage(TILE_ART[kind].src).catch(() => null)));
      if (cancelled || !containerRef.current) return;
      wheelRef.current = new Wheel(containerRef.current, {
        items: TILE_KINDS.map((kind, i) => ({
          label: TILE_ART[kind].label,
          backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
          image: images[i] ?? undefined,
          imageRadius: 0.62,
          imageScale: 1.3,
        })),
        isInteractive: false,
        itemLabelRadius: 0.92,
        itemLabelRadiusMax: 0.28,
        itemLabelFont: "'Nunito', sans-serif",
        itemLabelFontSizeMax: 18,
        itemLabelColors: ['#1a1420'],
        itemLabelStrokeColor: '#fff',
        itemLabelStrokeWidth: 4,
        lineWidth: 2,
        lineColor: '#1a1420',
        borderColor: '#1a1420',
        borderWidth: 5,
        radius: 0.92,
      });
      setWheelReady(true);
    })();
    return () => {
      cancelled = true;
      wheelRef.current?.remove();
      wheelRef.current = null;
      setWheelReady(false);
    };
  }, []);

  if (!student) return null;

  const doSpin = () => {
    if (!wheelRef.current) return;
    const index = Math.floor(Math.random() * TILE_KINDS.length);
    setSpinning(true);
    wheelRef.current.spinToItem(index, SPIN_DURATION_MS, true, 4, 1, null);
    playWheelSpin(SPIN_DURATION_MS);
    window.setTimeout(() => {
      setSpinning(false);
      setWon(TILE_KINDS[index]);
      playAchievementChime();
    }, SPIN_DURATION_MS + 100);
  };

  const giveToPet = (petId: string) => {
    carePet(petId, 'feed');
    setGaveToPetId(petId);
  };

  const wonArt = won ? TILE_ART[won] : null;
  const gaveToPetName = gaveToPetId ? myPets.find((p) => p.id === gaveToPetId)?.customName ?? 'your pet' : null;

  return (
    <div className="overlay-backdrop" onClick={spinning ? undefined : onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>🎡 Bakery Treat Wheel</h2>

          {won && wonArt ? (
            gaveToPetId ? (
              <>
                <img src={wonArt.src} alt="" style={{ width: 96, height: 96 }} />
                <p style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
                  🐾 You gave the {wonArt.label} to {gaveToPetName}!
                </p>
                <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0 }}>Their food bar went up a notch. 💛</p>
                <button className="btn btn-primary btn-lg" style={{ minHeight: 44 }} onClick={onClose}>Done</button>
              </>
            ) : (
              <>
                <img src={wonArt.src} alt="" style={{ width: 96, height: 96 }} />
                <p style={{ fontWeight: 800, fontSize: '1.2rem', margin: 0 }}>🎉 You won a {wonArt.label}!</p>
                <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: '-4px 0 0' }}>Eat it yourself, or share it with a pet?</p>
                <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
                  <button className="btn btn-lg btn-primary" style={{ minHeight: 44 }} onClick={onClose}>🍽️ Eat it!</button>
                </div>
                {myPets.length > 0 && (
                  <div className="stack" style={{ gap: 6, width: '100%' }}>
                    <p style={{ margin: '8px 0 0', fontSize: '0.8rem', fontWeight: 700 }}>🐾 Or give it to a pet:</p>
                    <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
                      {myPets.map((pet) => {
                        const def = petDefById(pet.petDefId);
                        return (
                          <button
                            key={pet.id}
                            className="btn btn-lg"
                            style={{ minHeight: 44, flexDirection: 'column', gap: 2, padding: '6px 10px' }}
                            onClick={() => giveToPet(pet.id)}
                          >
                            {def && <PetThumb modelPath={def.modelPath} name={pet.customName} />}
                            <span style={{ fontSize: '0.75rem' }}>{pet.customName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )
          ) : (
            <>
              <p style={{ opacity: 0.75, marginTop: -8 }}>One free spin, every prize is a treat!</p>
              <div style={{ position: 'relative', width: 240, height: 240 }}>
                <div aria-hidden style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', fontSize: '1.6rem', zIndex: 2 }}>🔻</div>
                <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
                {!wheelReady && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', opacity: 0.6 }}>
                    Loading wheel…
                  </div>
                )}
              </div>
              <button className="btn btn-primary btn-lg" style={{ minHeight: 44 }} disabled={spinning || !wheelReady} onClick={doSpin}>
                {spinning ? 'Spinning…' : 'Spin!'}
              </button>
              <button className="btn btn-sm" style={{ minHeight: 44 }} disabled={spinning} onClick={onClose}>Not now</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
