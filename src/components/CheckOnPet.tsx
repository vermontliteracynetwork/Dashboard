import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import type { SelZone } from '../types';
import { petDefById } from '../lib/petCatalog';
import { ageForTraining, AGE_LABEL, AGE_SCALE, PET_REPLY, petFeeling } from '../lib/petsV2';
import { useTrickSessions, learnedTricks, isLearned } from '../lib/petGym';
import { SEL_STARTER_TOOLS, SEL_ZONE_COLORS, SEL_ZONE_LABELS } from '../lib/selZones';
import { extractYouTubeId } from '../lib/youtube';
import SelZoneEmotionPicker from './SelZoneEmotionPicker';
import PetStage3D, { type TrickCue } from './PetStage3D';
import { PET_FOODS, feedFromInventory, foodById, usePetFood } from '../lib/petFood';

// "Check on your pet" (her Pets v2 spec, 2026-10-11): "Questions set function needs to have a
// break in the tools. it also needs to pop up if the students have been spamming answers ...
// a full screen freeze "Check on your pet" button in Take a Moment. pet should pop up large on
// the left side of the screen. options on the sides of the pet should show arrows that can rotate
// though the pets. they can see the full pet bars like social and health and all their skills.
// it should show an SEL check in (same as initial login) on the right hand side but present it
// like the pet shown is asking the student how they feel. it should be an aba style conversation
// checking in with the kid. zones of regulation. after 1 min, the pet should check in and ask if
// they are ready to return with what they are doing. they can also say stay with pet. they can
// listen to music with the boom box after check in. if the pet can dance (skill unlocked) they
// can dance along to the music"

export const CHECK_ON_PET_EVENT = 'check-on-pet';
export function openCheckOnPet(reason: 'break' | 'spam' | 'help') {
  window.dispatchEvent(new CustomEvent(CHECK_ON_PET_EVENT, { detail: { reason } }));
}

type Step = 'hello' | 'reply' | 'music';

function CheckOnPet({ reason, onClose }: { reason: 'break' | 'spam' | 'help'; onClose: () => void }) {
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const allPets = useStore((s) => s.pets);
  const recordSelCheckIn = useStore((s) => s.recordSelCheckIn);
  const carePet = useStore((s) => s.carePet);
  const musicTracks = useStore((s) => s.musicTracks);
  const pets = allPets.filter((p) => p.studentId === student?.id);
  const [i, setI] = useState(0);
  const pet = pets[Math.min(i, pets.length - 1)];
  const sessions = useTrickSessions(pet?.id);
  const [step, setStep] = useState<Step>('hello');
  const [said, setSaid] = useState('');
  const [zone, setZone] = useState<SelZone | null>(null);
  const [askReady, setAskReady] = useState(false);
  const [track, setTrack] = useState<string | null>(null);
  const [cue, setCue] = useState<TrickCue | null>(null);
  const timer = useRef<number | null>(null);
  // Her rule (2026-10-12): a small pet food bag under the bars; drag a food onto the pet to feed it
  // (a tap on a food works too).
  const food = usePetFood(student?.id);
  const stageRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; sx: number; sy: number } | null>(null);
  const dropFood = (id: string, x: number, y: number, tap: boolean) => {
    if (!pet || !student) return;
    const r = stageRef.current?.getBoundingClientRect();
    const onPet = tap || (!!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
    if (!onPet) return;
    if (pet.food >= 100) { setSaid(`I'm full, thank you! Save that ${foodById(id)?.name.toLowerCase()} for later.`); return; }
    const f = feedFromInventory(student.id, pet.id, id);
    if (f) { setSaid(`Yum! Thank you for the ${f.name.toLowerCase()}! My food bar went up.`); setCue({ name: 'Sit', at: Date.now() }); }
  };
  const armReadyCheck = () => { if (timer.current) window.clearTimeout(timer.current); setAskReady(false); timer.current = window.setTimeout(() => setAskReady(true), 60000); };
  useEffect(() => { armReadyCheck(); return () => { if (timer.current) window.clearTimeout(timer.current); }; }, []);
  useEffect(() => {
    if (!pet || !student) return;
    setSaid(reason === 'spam'
      ? `Hi ${student.name}, it's me, ${pet.customName}! Let's take a little break together. Those answers were going really fast. How are you feeling?`
      : `Hi ${student.name}, it's me, ${pet.customName}! I missed you. How are you feeling?`);
    setStep('hello'); setZone(null);
  }, [pet?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // A pet that learned Dance dances along while the music plays.
  const canDance = !!pet && isLearned(sessions, 'Dance');
  useEffect(() => {
    if (!track || !canDance) return;
    setCue({ name: 'Dance', at: Date.now() });
    const t = window.setInterval(() => setCue({ name: 'Dance', at: Date.now() }), 3000);
    return () => window.clearInterval(t);
  }, [track, canDance]);

  if (!student) return null;
  const def = pet ? petDefById(pet.petDefId) : undefined;
  const ytId = track ? extractYouTubeId(track) : null;

  return (
    <div className="cop" role="dialog" aria-modal="true" aria-label="Check on your pet">
      <div className="cop-left">
        {pet && def ? (
          <>
            <div className="cop-stage" ref={stageRef}>
              <PetStage3D modelPath={def.modelPath} ageScale={AGE_SCALE[ageForTraining(pet.trainingProgress)]} trick={cue} idleSpin={!track} yaw={-0.4} />
              {pets.length > 1 && <button type="button" className="cop-arrow prev" aria-label="Previous pet" onClick={() => setI((i + pets.length - 1) % pets.length)}>◀</button>}
              {pets.length > 1 && <button type="button" className="cop-arrow next" aria-label="Next pet" onClick={() => setI((i + 1) % pets.length)}>▶</button>}
            </div>
            <div className="cop-card">
              <h2>{pet.customName}</h2>
              <div className="cop-sub">{AGE_LABEL[ageForTraining(pet.trainingProgress)]} {def.name}, training {pet.trainingProgress}</div>
              {(() => { const f = petFeeling(pet); return <div className="cop-zone" style={{ background: SEL_ZONE_COLORS[f.zone] }}>{f.face} {f.emotion}, {SEL_ZONE_LABELS[f.zone]} Zone</div>; })()}
              {([['🍗 Food', pet.food, '#D98C1E'], ['💞 Social', pet.social, '#3E9BD6'], ['❤️ Health', pet.health, '#E2574C']] as const).map(([l, v, c]) => (
                <div key={l} className="cop-stat"><b><span>{l}</span><span>{Math.round(v)} / 100</span></b><div className="cop-bar"><i style={{ width: `${v}%`, background: c }} /></div></div>
              ))}
              <div className="cop-food" aria-label="Pet food bag">
                <b>Pet food</b>
                {PET_FOODS.some((f) => (food[f.id] ?? 0) > 0) ? (
                  <div className="cop-food-row">
                    {PET_FOODS.filter((f) => (food[f.id] ?? 0) > 0).map((f) => (
                      <button key={f.id} type="button" className="cop-food-item" aria-label={`${f.name}, ${food[f.id]} left. Drag to ${pet.customName} or tap to feed.`}
                        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDrag({ id: f.id, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); }}
                        onPointerMove={(e) => setDrag((d) => (d && d.id === f.id ? { ...d, x: e.clientX, y: e.clientY } : d))}
                        onPointerUp={(e) => { const d = drag; setDrag(null); if (d) dropFood(f.id, e.clientX, e.clientY, Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8); }}
                        onPointerCancel={() => setDrag(null)}>
                        <img src={f.img} alt="" draggable={false} /><span>{food[f.id]}</span>
                      </button>
                    ))}
                  </div>
                ) : <small>No food yet. Buy some in the Marketplace, or earn it in Farm Grow and Doc Fishing.</small>}
                {PET_FOODS.some((f) => (food[f.id] ?? 0) > 0) && <small>Drag food to {pet.customName}, or tap it.</small>}
              </div>
              <div className="cop-skills">🎪 Tricks: Stand/Stay{learnedTricks(sessions).length ? `, ${learnedTricks(sessions).join(', ')}` : ''}</div>
            </div>
          </>
        ) : (
          <div className="cop-card"><h2>Take a Moment</h2><div className="breathe-circle" /><p>Breathe in as the circle grows. Breathe out as it shrinks.</p></div>
        )}
      </div>
      <div className="cop-right">
        {pet && <div className="cop-bubble" aria-live="polite">{said}</div>}
        {!pet && <div className="cop-bubble">Let's slow down and take a breath. How are you feeling?</div>}
        {step === 'hello' && (
          <div className="cop-picker">
            <SelZoneEmotionPicker hideQuestion onPick={(z, emotion) => {
              recordSelCheckIn(student.id, z, emotion);
              if (pet) carePet(pet.id, 'talk');
              setZone(z);
              const reply = PET_REPLY[z][Math.floor(Math.random() * PET_REPLY[z].length)];
              const tool = SEL_STARTER_TOOLS[z][0];
              setSaid(`You feel ${emotion.toLowerCase()}. Thank you for telling me. ${reply}${tool && z !== 'green' ? ` Let's try this: ${tool.toLowerCase()}.` : ''}`);
              setStep('reply');
            }} />
          </div>
        )}
        {step !== 'hello' && (
          <div className="cop-actions">
            {zone && <div className="cop-zone" style={{ background: SEL_ZONE_COLORS[zone] }}>You checked in: {SEL_ZONE_LABELS[zone]} Zone</div>}
            <button type="button" className="btn btn-lg" onClick={() => { setStep('music'); setSaid(canDance ? `Pick a song! I'll dance with you.` : `Pick a song and we'll listen together.`); }}>Listen to music with {pet?.customName ?? 'me'}</button>
            <button type="button" className="btn btn-lg btn-primary" onClick={onClose}>I'm ready to go back</button>
          </div>
        )}
        {step === 'music' && (
          <div className="cop-boombox">
            <div className="cop-boombox-head">📻 Boom Box</div>
            {/* Her rules (2026-10-12): music is audio only, never a video, and it comes from the
                youtube-nocookie.com address (the same one the music player uses) instead of youtube.com,
                so it still plays where youtube.com is blocked. The player is a hidden 1 pixel frame. */}
            {ytId ? (
              <>
                <div className="cop-nowplaying" aria-live="polite">
                  <span className="cop-eq" aria-hidden><i /><i /><i /><i /></span>
                  <span>Now playing: <b>{musicTracks.find((t) => t.url === track)?.title ?? 'a song'}</b></span>
                </div>
                <iframe title="Music" src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&playsinline=1&controls=0`} allow="autoplay; encrypted-media"
                  style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 'none', left: 0, bottom: 0 }} />
              </>
            ) : <p>{musicTracks.length ? 'Tap a song to play it.' : 'No songs yet. Ask your teacher to add some!'}</p>}
            <div className="cop-tracks">
              {musicTracks.slice(0, 12).map((t) => (
                <button key={t.id} type="button" className={`btn${track === t.url ? ' btn-primary' : ''}`} onClick={() => setTrack(t.url)}>{t.title}</button>
              ))}
              {track && <button type="button" className="btn" onClick={() => setTrack(null)}>Stop</button>}
            </div>
          </div>
        )}
      </div>
      {drag && Math.hypot(drag.x - drag.sx, drag.y - drag.sy) >= 8 && <img className="cop-food-ghost" src={foodById(drag.id)?.img} alt="" style={{ left: drag.x, top: drag.y }} />}
      {askReady && (
        <div className="cop-ready" role="dialog" aria-label="Ready to go back?">
          <p>{pet ? `${pet.customName}: ` : ''}Are you ready to go back to what you were doing?</p>
          <div className="cop-actions">
            <button type="button" className="btn btn-lg btn-primary" onClick={onClose}>I'm ready</button>
            <button type="button" className="btn btn-lg" onClick={armReadyCheck}>Stay with {pet?.customName ?? 'my pet'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Mounted once for students; opens on the Break tool, on guessing, or from Take a Moment.
export default function CheckOnPetHost() {
  const role = useStore((s) => s.role);
  const [open, setOpen] = useState<null | 'break' | 'spam' | 'help'>(null);
  useEffect(() => {
    const on = (e: Event) => setOpen(((e as CustomEvent).detail?.reason as 'break' | 'spam' | 'help') ?? 'break');
    window.addEventListener(CHECK_ON_PET_EVENT, on);
    return () => window.removeEventListener(CHECK_ON_PET_EVENT, on);
  }, []);
  if (role !== 'student' || !open) return null;
  return <CheckOnPet reason={open} onClose={() => setOpen(null)} />;
}
