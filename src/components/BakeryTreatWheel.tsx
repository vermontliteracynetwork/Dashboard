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
// Eight sparkle particles scattered around the won treat, each given its
// own outward angle/distance/delay via CSS custom properties (--sx/--sy
// picked once per render below, not regenerated on every re-render).
const SPARKLE_COUNT = 8;
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

  // A fixed set of outward burst vectors/delays for the sparkle particles
  // around the won treat, recomputed only when a new prize actually lands
  // — kept above the early `if (!student)` return below so hook order
  // never changes between renders.
  const sparkles = useMemo(() => {
    if (!won) return [];
    return Array.from({ length: SPARKLE_COUNT }).map((_, i) => {
      const angle = (i / SPARKLE_COUNT) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 40;
      return {
        sx: Math.cos(angle) * dist,
        sy: Math.sin(angle) * dist,
        delay: Math.random() * 0.15,
        emoji: i % 2 === 0 ? '✨' : '⭐',
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

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
          // Bigger wheel (below), so the treat image gets more room and
          // sits further out toward the rim — direct teacher instruction:
          // "show the image of each item on this wheel," which the wheel
          // already tried to do, but too small/central to read clearly.
          imageRadius: 0.68,
          imageScale: 1.6,
        })),
        isInteractive: false,
        itemLabelRadius: 0.92,
        itemLabelRadiusMax: 0.24,
        itemLabelFont: "'Nunito', sans-serif",
        itemLabelFontSizeMax: 22,
        itemLabelColors: ['#1a1420'],
        itemLabelStrokeColor: '#fff',
        itemLabelStrokeWidth: 4,
        lineWidth: 2,
        lineColor: '#1a1420',
        borderColor: '#1a1420',
        borderWidth: 6,
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
      <div className="overlay-panel chrome-frame" style={{ padding: 28, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>🎡 Bakery Treat Wheel</h2>

          {won && wonArt ? (
            gaveToPetId ? (
              <>
                <div className="wheel-win-wrap">
                  <img key={won} src={wonArt.src} alt="" className="wheel-win-img" style={{ width: 150, height: 150 }} />
                  {sparkles.map((s, i) => (
                    <span key={i} className="wheel-sparkle" style={{ '--sx': `${s.sx}px`, '--sy': `${s.sy}px`, animationDelay: `${s.delay}s` } as React.CSSProperties}>{s.emoji}</span>
                  ))}
                </div>
                <p style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
                  🐾 You gave the {wonArt.label} to {gaveToPetName}!
                </p>
                <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0 }}>Their food bar went up a notch. 💛</p>
                <button className="btn btn-primary btn-lg" style={{ minHeight: 44 }} onClick={onClose}>Done</button>
              </>
            ) : (
              <>
                <div className="wheel-win-wrap">
                  <img key={won} src={wonArt.src} alt="" className="wheel-win-img" style={{ width: 150, height: 150 }} />
                  {sparkles.map((s, i) => (
                    <span key={i} className="wheel-sparkle" style={{ '--sx': `${s.sx}px`, '--sy': `${s.sy}px`, animationDelay: `${s.delay}s` } as React.CSSProperties}>{s.emoji}</span>
                  ))}
                </div>
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
              <div style={{ position: 'relative', width: 360, height: 360, maxWidth: '100%' }}>
                <div aria-hidden style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', fontSize: '2rem', zIndex: 2 }}>🔻</div>
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
