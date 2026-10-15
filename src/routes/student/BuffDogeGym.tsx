import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQLog } from '../../lib/questionLog';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import type { MCQuestion, StudentPet } from '../../types';
import { petDefById } from '../../lib/petCatalog';
import { ageForTraining, AGE_LABEL, AGE_SCALE } from '../../lib/petsV2';
import {
  TRICKS, STAND_STAY, SESSION_MINUTES, SESSION_QUESTIONS, DROP_FEE_CENTS, DROP_FEE_QUESTIONS, trickDef, isLearned, speakOpen,
  trainable, recommend, creditSession, useTrickSessions, useGym, setGym, clearGym, useFee, clearFee, useTreats, addTreats, gymRowOf,
} from '../../lib/petGym';
import { formatMoney } from '../../lib/money';
import { drawQuestion } from '../../lib/questionPick';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { playCashRegister } from '../../lib/chime';
import { playCheer } from '../../lib/petSounds';
import { sayInPetVoice, petVoiceLine } from '../../lib/petSpeak';
import { useBack } from '../../lib/navTrail';
import { speak } from '../../components/ReadAloud';
import TurnSideways from '../../components/TurnSideways';
import { recordStreakCorrect } from '../../lib/streak';
import { openCheckOnPet } from '../../components/CheckOnPet';
import PetStage3D, { type TrickCue } from '../../components/PetStage3D';
import GymSignInForm, { type PayWay } from './GymSignInForm';

// Buff Doge's Gym (her Pets v2 spec and her own prototype, 2026-10-11). Rebuilt from her
// Buff_Doges_Gym.html with her art (the gym, the sign, Buff Doge, the dice and the bone treat):
// "Players' pets can be dropped off at the gym and can be picked up at a certain time when
// training is completed ... Conversation between buff doge and the player should be about which
// skill they would like to work on with what pet. pets need to be signed in. only one pet can be
// left in Buff Doge's care at a time ... Buff doge can recommend a skill to work on, but it would
// be random within the level the pet is at." and "general training game: something with
// polyhedral dice that has question sets intermittently added."

const W = 1920, H = 1080;
const ART = '/pets/gym/';
const DICE = [4, 6, 8, 10, 12, 20];
type Opt = { label: string; sub?: string; disabled?: boolean; go: () => void; tone?: 'right' | 'wrong' };
type Mode = 'lobby' | 'picker' | 'desk' | 'result' | 'barter' | 'nopets';
interface Quiz { kind: 'train' | 'fee'; petId: string; trick: string; target: number; n: number; block: number; blockWrong: boolean; q: MCQuestion; paid?: boolean }

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function BuffDogeGym() {
  const navigate = useNavigate();
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const allPets = useStore((s) => s.pets);
  const questionSets = useStore((s) => s.questionSets);
  const recordTransaction = useStore((s) => s.recordTransaction);
  const carePet = useStore((s) => s.carePet);
  const studentId = student?.id ?? null;
  const pets = useMemo(() => allPets.filter((p) => p.studentId === studentId), [allPets, studentId]);
  const gym = useGym(studentId);
  const fee = useFee(studentId);
  const treats = useTreats(studentId);

  // ---- stage scaling (her prototype: a 1920 x 1080 stage scaled to fit) ----
  const wrap = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ s: 0.5, x: 0, y: 0 });
  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const go = () => { const r = el.getBoundingClientRect(); const s = Math.min(r.width / W, r.height / H); setFit({ s, x: (r.width - W * s) / 2, y: (r.height - H * s) / 2 }); };
    go();
    const ro = new ResizeObserver(go); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Buff Doge's speech bubble, typed out ----
  const [say, setSay] = useState('');
  const [sayBig, setSayBig] = useState(false);
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (reduceMotion()) { setTyped(say); return; }
    let i = 0; setTyped('');
    const t = window.setInterval(() => { i += 2; setTyped(say.slice(0, i)); if (i >= say.length) window.clearInterval(t); }, 16);
    return () => window.clearInterval(t);
  }, [say]);
  const talk = (text: string, big = false) => { setSay(text); setSayBig(big); };
  const [dogeBig, setDogeBig] = useState(false);
  const [flex, setFlex] = useState(0);

  // ---- Pokemon style announcement + the trick on the pet ----
  const [announce, setAnnounce] = useState<string | null>(null);
  const [cue, setCue] = useState<TrickCue | null>(null);
  const annTimer = useRef<number | null>(null);
  const useTrick = (pet: StudentPet, trick: string) => {
    const move = trick === STAND_STAY.name ? STAND_STAY.move : trickDef(trick)?.move ?? trick;
    setAnnounce(`${pet.customName} uses ${move}!`);
    setCue({ name: trick, at: Date.now() });
    if (trick === 'Speak') window.setTimeout(() => sayInPetVoice(petVoiceLine(pet.petDefId)), 400);
    if (annTimer.current) window.clearTimeout(annTimer.current);
    annTimer.current = window.setTimeout(() => setAnnounce(null), 3400);
  };

  // ---- state ----
  const [mode, setMode] = useState<Mode>('picker');
  const [sel, setSel] = useState(0);
  const [opts, setOpts] = useState<{ list: Opt[]; two?: boolean; page: number }>({ list: [], page: 0 });
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quitAsk, setQuitAsk] = useState(false);
  const [dice, setDice] = useState<{ label: string; sides: number; out: string } | null>(null);
  const [resultPetId, setResultPetId] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const pet = pets[Math.min(sel, Math.max(0, pets.length - 1))] as StudentPet | undefined;
  const sessions = useTrickSessions(pet?.id);
  const shownPetId = mode === 'result' || mode === 'barter' ? resultPetId : mode === 'picker' ? pet?.id ?? null : null;
  const shownPet = pets.find((p) => p.id === shownPetId) ?? null;

  const options = (list: Opt[], two = false) => setOpts({ list, two, page: 0 });

  // ---- screens ----
  // Her lobby art (2026-10-12 zip): the gym full of pets working out, Buff Doge greeting you.
  const lobby = () => {
    setMode('lobby'); setDogeBig(false); setQuiz(null); setOpts({ list: [], page: 0 });
    talk(pets.length ? `Welcome to Buff Doge's Gym! I'm Buff Doge, personal trainer for pets. Ready to train?` : `Welcome to Buff Doge's Gym! I'm Buff Doge, personal trainer for pets.`);
  };
  const picker = (index = sel) => {
    setMode('picker'); setDogeBig(false); setQuiz(null); setOpts({ list: [], page: 0 });
    if (!pets.length) { setMode('nopets'); setDogeBig(true); talk(`Welcome to Buff Doge's Gym! You need a pet before we can train. Adopt one in the Pet Finder, then come pump some iron with me.`, true); options([{ label: '🐾 Open the Pet Finder', go: () => navigate('/student/pet-finder') }, { label: '← Leave the gym', go: back.go }], true); return; }
    const p = pets[index]; if (!p) return;
    const g = gymRowOf(p.studentId);
    const s = sessionsFor(p.id);
    if (g.petId === p.id) talk(`${p.customName} is in my care right now, training ${g.trick}.`);
    else if (g.petId) talk(`I'm already training ${petName(g.petId)}. One pet at a time, friend. Pick up ${petName(g.petId)} first.`);
    else talk(trainable(p, s).length ? `Welcome to Buff Doge's Gym! Want to sign ${p.customName} in for training?` : `${p.customName} knows every trick. Such legend.`);
  };
  const sessionsFor = (petId: string) => (useStore.getState().styleLooks.find((r) => r.ownerId === `pettricks:${petId}`)?.look as { sessions?: Record<string, number> } | undefined)?.sessions ?? {};
  const petName = (id: string) => pets.find((p) => p.id === id)?.customName ?? 'your pet';

  // Signing in is a real form the student walks through (her words, 2026-10-12; see GymSignInForm).
  const [form, setForm] = useState(false);
  const signIn = () => {
    if (!pet) return;
    setForm(true); setDogeBig(false);
    talk(`Fill in the sign-in form for ${pet.customName}, one step at a time.`);
  };
  const formDone = (trick: string, pay: PayWay) => {
    setForm(false);
    if (!pet || !student) return;
    const t = trickDef(trick)!;
    if (pay === 'money') {
      recordTransaction(student.id, -t.costCents, `🏋️ Buff Doge's Gym: ${pet.customName}, ${trick} session`, '🏋️', 'purchase-pet');
      playCashRegister();
      setGym(student.id, { petId: pet.id, trick, readyAt: Date.now() + SESSION_MINUTES * 60000, paid: true });
      window.setTimeout(() => desk(pet.id), 50);
    } else if (pay === 'questions') startQuiz({ kind: 'train', petId: pet.id, trick, target: SESSION_QUESTIONS });
    else navigate('/student/library');
  };
  const desk = (petIdArg?: string) => {
    const g = gymRowOf(studentId ?? '');
    const petId = petIdArg ?? g.petId; if (!petId || !g.trick || !g.readyAt) { picker(); return; }
    const p = pets.find((x) => x.id === petId); if (!p) { picker(); return; }
    setSel(pets.indexOf(p)); setMode('desk'); setDogeBig(true);
    const ready = Date.now() >= g.readyAt, mins = Math.max(1, Math.ceil((g.readyAt - Date.now()) / 60000));
    talk(ready ? `${p.customName} finished this ${g.trick} session. Ready for pickup!` : `${p.customName} is training ${g.trick} with me. Ready at ${fmtTime(g.readyAt)}, in about ${mins} minute${mins === 1 ? '' : 's'}.`, true);
    options([
      { label: `Pick up ${p.customName}`, sub: ready ? 'Session complete' : `Ready at ${fmtTime(g.readyAt)}`, disabled: !ready, go: () => pickUp(p.id, g.trick!) },
      { label: `Answer ${SESSION_QUESTIONS} questions`, sub: 'Finish the session now', disabled: ready, go: () => startQuiz({ kind: 'train', petId: p.id, trick: g.trick!, target: SESSION_QUESTIONS, paid: true }) },
      { label: 'See my pets', go: () => picker(pets.indexOf(p)) },
    ]);
  };
  const pickUp = (petId: string, trick: string) => {
    if (!studentId) return;
    clearGym(studentId);
    result(petId, trick, creditSession(petId, trick));
  };
  const result = (petId: string, trick: string, r: { done: number; need: number; learned: boolean }, via?: 'fee') => {
    const p = pets.find((x) => x.id === petId); if (!p) { picker(); return; }
    setResultPetId(petId); setMode('result'); setDogeBig(true); setFlex((n) => n + 1);
    talk(`${via === 'fee' ? 'Fee settled! ' : ''}Session complete! ${p.customName} has ${r.done} of ${r.need} ${trick} sessions.${r.learned ? ` ${p.customName} learned ${trick}!` : ''} Give ${p.customName} a treat?`, true);
    if (r.learned) { playCheer(); window.setTimeout(() => useTrick(p, trick), 900); }
    feedOptions(petId);
  };
  const feedOptions = (petId: string) => {
    const p = useStore.getState().pets.find((x) => x.id === petId); if (!p || !studentId) return;
    const have = (useStore.getState().styleLooks.find((r) => r.ownerId === `pettreats:${studentId}`)?.look as { treats?: number } | undefined)?.treats ?? 0;
    const full = p.food >= 100;
    options([
      { label: `🦴 Give ${p.customName} a treat`, sub: full ? 'Food bar is full' : `Food ${Math.round(p.food)} / 100, ${have} treats`, disabled: full || have < 1, go: () => {
        addTreats(studentId, -1); carePet(p.id, 'feed'); setFlex((n) => n + 1);
        const after = Math.min(100, p.food + 25);
        talk(after >= 100 ? `Yum! ${p.customName}'s food bar is full.` : `Yum! ${p.customName}'s food bar is now ${Math.round(after)} / 100.`, true);
        window.setTimeout(() => feedOptions(petId), 30);
      } },
      { label: 'Back to my pets', go: () => picker(Math.max(0, pets.findIndex((x) => x.id === petId))) },
    ], true);
  };
  const barter = () => {
    if (!fee.petId || !fee.trick || !student) return;
    const p = pets.find((x) => x.id === fee.petId);
    setResultPetId(fee.petId); setMode('barter'); setDogeBig(true);
    talk(`Welcome back! You left while ${p?.customName ?? 'your pet'} was training, so I dropped ${p?.customName ?? 'your pet'} off at home. The drop-off fee is ${formatMoney(DROP_FEE_CENTS)}, or you can answer ${DROP_FEE_QUESTIONS} questions with me.`, true);
    options([
      { label: `Pay ${formatMoney(DROP_FEE_CENTS)}`, sub: student.coins < DROP_FEE_CENTS ? `You have ${formatMoney(student.coins)}` : undefined, disabled: student.coins < DROP_FEE_CENTS, go: () => {
        recordTransaction(student.id, -DROP_FEE_CENTS, `🏋️ Buff Doge's drop-off fee (${p?.customName ?? 'pet'})`, '🏋️', 'purchase-pet');
        playCashRegister(); settleFee();
      } },
      { label: `Answer ${DROP_FEE_QUESTIONS} questions`, go: () => startQuiz({ kind: 'fee', petId: fee.petId!, trick: fee.trick!, target: DROP_FEE_QUESTIONS }) },
    ], true);
  };
  const settleFee = () => {
    if (!studentId || !fee.petId || !fee.trick) return;
    const r = { done: fee.done ?? 1, need: fee.need ?? 1, learned: !!fee.learned };
    const petId = fee.petId, trick = fee.trick;
    clearFee(studentId);
    result(petId, trick, r, 'fee');
  };

  // ---- the dice training game ----
  const nextQuestion = (avoid?: string): MCQuestion => drawQuestion(questionSets, avoid) ?? generateAutoQuestion();
  const startQuiz = (c: Omit<Quiz, 'n' | 'block' | 'blockWrong' | 'q'>) => setQuiz({ ...c, n: 0, block: 0, blockWrong: false, q: nextQuestion() });
  const onRight = () => {
    if (!quiz || !studentId) return;
    const n = quiz.n + 1, block = quiz.block + (quiz.blockWrong ? 0 : 1);
    addTreats(studentId, 1);
    if (n >= quiz.target) { finishQuiz(); return; }
    if (n % 5 === 0) { setQuiz({ ...quiz, n, block: 0, blockWrong: false }); roll(block, { ...quiz, n, block: 0, blockWrong: false, q: nextQuestion(quiz.q.id) }); return; }
    setQuiz({ ...quiz, n, block, blockWrong: false, q: nextQuestion(quiz.q.id) });
  };
  const roll = (k: number, after: Quiz) => {
    const sides = DICE[Math.min(5, k)], v = 1 + Math.floor(Math.random() * sides), bonus = Math.ceil(v / 2);
    setQuiz(null);
    setDice({ label: `${k} of 5 right on the first try: you get the d${sides}!`, sides, out: '' });
    window.setTimeout(() => { setDice((d) => (d ? { ...d, out: `Rolled ${v}! +${bonus} bonus treats` } : d)); if (studentId) addTreats(studentId, bonus); }, reduceMotion() ? 100 : 1300);
    window.setTimeout(() => { setDice(null); setQuiz(after); }, reduceMotion() ? 1600 : 2900);
  };
  const finishQuiz = () => {
    if (!quiz || !studentId) return;
    const q = quiz; setQuiz(null);
    if (q.kind === 'fee') { settleFee(); return; }
    if (gymRowOf(studentId).petId === q.petId) clearGym(studentId);
    result(q.petId, q.trick, creditSession(q.petId, q.trick));
  };

  // ---- first screen ----
  useEffect(() => {
    if (!firstLoad.current || !studentId) return;
    firstLoad.current = false;
    if (fee.petId) { barter(); return; }
    if (gym.petId) { desk(gym.petId); return; }
    lobby();
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the desk countdown fresh.
  useEffect(() => {
    if (mode !== 'desk') return;
    const t = window.setInterval(() => desk(), 20000);
    return () => window.clearInterval(t);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!student) return null;

  const visibleOpts = (() => {
    const { list, page } = opts;
    if (list.length <= 4) return list;
    const shown = list.slice(page * 3, page * 3 + 3);
    const more = (page + 1) * 3 < list.length;
    return [...shown, { label: more ? 'More' : 'Start over', sub: more ? `${list.length - (page + 1) * 3} more` : '', go: () => setOpts({ ...opts, page: more ? page + 1 : 0 }) }];
  })();

  const age = pet ? ageForTraining(pet.trainingProgress) : 'baby';
  const showCard = mode === 'picker' && pet && !quiz;
  const stagePet = mode === 'picker' ? pet : shownPet;
  const stagePetDef = stagePet ? petDefById(stagePet.petDefId) : undefined;
  const g = gym;
  const trainLabel = !pet ? '' : g.petId === pet.id ? `Check on ${pet.customName}` : `Sign in ${pet.customName}`;
  const trainDisabled = !pet || (g.petId ? g.petId !== pet.id : trainable(pet, sessions).length === 0);

  const chip = (t: string, locked: boolean) => {
    if (!pet) return null;
    if (t === STAND_STAY.name) return <button key={t} type="button" className="bdg-chip done" onClick={() => useTrick(pet, t)}>{STAND_STAY.icon} Stand/Stay</button>;
    const d = trickDef(t)!, n = sessions[t] ?? 0;
    if (isLearned(sessions, t)) return <button key={t} type="button" className="bdg-chip done" onClick={() => useTrick(pet, t)} aria-label={`${t}, learned. Do this trick`}>{t}</button>;
    if (locked) return <span key={t} className="bdg-chip lock" aria-label={`${t}, locked`}>🔒 {t}</span>;
    return <span key={t} className="bdg-chip" aria-label={`${t}, ${n} of ${d.sessions} sessions`}>{t} <em>{n}/{d.sessions}</em></span>;
  };
  const AGE_GROUPS: { age: 'baby' | 'juvenile' | 'adult'; label: string }[] = [{ age: 'baby', label: 'Baby' }, { age: 'juvenile', label: 'Juvenile' }, { age: 'adult', label: 'Adult' }];
  const ageIdx = ['baby', 'juvenile', 'adult'].indexOf(age);
  const bar = (label: string, v: number, color: string) => (
    <div className="bdg-stat" key={label}><b><span>{label}</span><span>{v >= 100 ? 'Full' : `${Math.round(v)} / 100`}</span></b><div className="bdg-bar"><i style={{ width: `${Math.min(100, v)}%`, background: color }} /></div></div>
  );

  return (
    <div className="bdg-wrap" ref={wrap}>
      <div className="bdg-stage" style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.s})` }}>
        {mode === 'lobby'
          ? <img className="bdg-layer" src={`${ART}lobby.jpg`} alt="Buff Doge's Gym, full of pets working out" style={{ left: 0, top: 0, width: 1920, height: 1080 }} />
          : <>
            <img className="bdg-layer" src={`${ART}bg.jpg`} alt="" style={{ left: 0, top: 0, width: 1920, height: 1080 }} />
            <img className="bdg-layer" src={`${ART}sign.jpg`} alt="Buff Doge's Gym" style={{ left: 26, top: 0, width: 480, height: 212 }} />
            <img key={flex} className={`bdg-layer bdg-doge${dogeBig || quiz ? ' big' : ''}${flex ? ' flex' : ''}`} src={`${ART}doge.png`} alt="Buff Doge" />
          </>}

        {!quiz && stagePet && stagePetDef && (
          <div className={`bdg-pet ${mode === 'picker' ? 'center' : 'corner'}`}>
            <PetStage3D modelPath={stagePetDef.modelPath} ageScale={AGE_SCALE[ageForTraining(stagePet.trainingProgress)]} trick={cue} idleSpin={mode === 'picker'} />
          </div>
        )}

        {say && !quiz && <div className={`bdg-bubble ${sayBig ? 'big' : 'small'}`} role="status" aria-live="polite"><p>{typed}</p><button type="button" className="bdg-listen" onClick={() => speak(say, student.ttsSettings)} aria-label="Listen to Buff Doge">🔊</button></div>}
        {mode === 'lobby' && <button type="button" className="bdg-btn bdg-arrow bdg-lobby-go" aria-label="Let's go, pick a pet to train" onClick={() => picker(0)}>▶</button>}
        {quiz && <DogeQuiz key={`${quiz.n}-${quiz.q.id}`} quiz={quiz} tts={student.ttsSettings} onRight={onRight}
          onWrong={() => setQuiz((q) => (q ? { ...q, blockWrong: true } : q))}
          onSkip={() => setQuiz((q) => (q ? { ...q, blockWrong: true, q: nextQuestion(q.q.id) } : q))} />}

        {showCard && pet && (
          <div className="bdg-card">
            <h2>{pet.customName}</h2>
            <div className="bdg-breed">{petDefById(pet.petDefId)?.name}</div>
            <div className="bdg-lvl">{AGE_LABEL[age]}, training {pet.trainingProgress}</div>
            {bar('Food', pet.food, '#D98C1E')}{bar('Social', pet.social, '#3E9BD6')}{bar('Health', pet.health, '#E2574C')}
            <div className="bdg-skillhead">Tricks <span>tap a learned trick to see it</span></div>
            <div className="bdg-chips">{chip(STAND_STAY.name, false)}</div>
            {AGE_GROUPS.map((gr, i) => (
              <div key={gr.age}><div className="bdg-agehead">{gr.label}</div><div className="bdg-chips">{TRICKS.filter((t) => t.age === gr.age).map((t) => chip(t.name, i > ageIdx))}</div></div>
            ))}
            <div className="bdg-chips" style={{ marginTop: 6 }}>{chip('Speak', !speakOpen(sessions))}</div>
          </div>
        )}
        {mode === 'picker' && pet && !quiz && (
          <>
            <button type="button" className="bdg-btn bdg-train" disabled={trainDisabled} onClick={() => (g.petId === pet.id ? desk(pet.id) : signIn())}>{trainLabel}</button>
            {pets.length > 1 && <button type="button" className="bdg-btn bdg-arrow prev" aria-label="Previous pet" onClick={() => { const i = (sel + pets.length - 1) % pets.length; setSel(i); picker(i); }}>◀</button>}
            {pets.length > 1 && <button type="button" className="bdg-btn bdg-arrow next" aria-label="Next pet" onClick={() => { const i = (sel + 1) % pets.length; setSel(i); picker(i); }}>▶</button>}
          </>
        )}

        {mode !== 'picker' && visibleOpts.length > 0 && (
          <div className={`bdg-options${opts.two ? ' two' : ''}`}>
            {visibleOpts.map((o, i) => (
              <button key={`${o.label}-${i}`} type="button" className="bdg-btn" disabled={o.disabled} onClick={o.go}>{o.label}{o.sub ? <small>{o.sub}</small> : null}</button>
            ))}
          </div>
        )}

        {/* Leaving the gym is the big Town Square button (her words: "make sure the buff doge screens has a very
            clear exit back to towns quare"); this corner arrow only stops a quiz or goes back to the pets. */}
        {(quiz || mode === 'desk' || mode === 'result') && (
          <button type="button" className={`bdg-btn bdg-arrow bdg-back${quiz ? ' bdg-x' : ''}`} aria-label={quiz ? 'Stop answering' : 'Back to my pets'} onClick={() => {
            if (quiz) { setQuitAsk(true); return; }
            picker();
          }}>{quiz ? '✕' : '◀'}</button>
        )}

        {/* On the question screen the corner shows only how many she got right on the first try (her words,
            2026-10-14: "a total questions answered correctly metor should be on the top right. only mark
            correctly answered questions. incorrect questions should never count toward the meter"). */}
        {quiz
          ? <div className="bdg-hud bdg-meter" aria-label={`${quiz.n} of ${quiz.target} answered correctly`}><span aria-hidden>✅</span><span>{quiz.n} / {quiz.target}</span><small>correct</small></div>
          : <div className="bdg-hud"><span className="bdg-cash" aria-label="Money">{formatMoney(student.coins)}</span><img src={`${ART}bone.png`} alt="Treats" /><span>{treats}</span></div>}

        {announce && <div className="bdg-announce" role="status" aria-live="polite">{announce}</div>}

        {dice && (
          <div className="bdg-dice" role="dialog" aria-label="Training dice roll">
            <div className="bdg-dice-box">
              <div className="bdg-dice-lbl">{dice.label}</div>
              <img key={dice.label} className={reduceMotion() ? '' : 'rolling'} src={`${ART}d${dice.sides}.png`} alt={`A ${dice.sides} sided die`} />
              <div className="bdg-dice-out" aria-live="polite">{dice.out}</div>
            </div>
          </div>
        )}
      </div>

      {!quiz && !form && <button type="button" className="btn btn-lg bdg-exit" onClick={() => navigate('/world/town')}>← Back to Town Square</button>}
      {form && pet && (
        <GymSignInForm ownerName={student.name} coins={student.coins} pet={pet} sessions={sessionsFor(pet.id)}
          tricks={(() => { const s2 = sessionsFor(pet.id), rec = recommend(pet, s2); const list = trainable(pet, s2); return list.sort((a, b) => Number(b.name === rec?.name) - Number(a.name === rec?.name)); })()}
          recommended={recommend(pet, sessionsFor(pet.id))?.name} tts={student.ttsSettings}
          onCancel={() => { setForm(false); picker(); }} onDone={formDone} />
      )}
      {quitAsk && quiz && (
        <div className="bdg-modal-back">
          <div className="bdg-modal">
            <h2>{quiz.kind === 'fee' ? 'The drop-off fee still needs to be settled.' : 'Stop this session?'}</h2>
            <p>{quiz.kind === 'fee' ? 'You can pay the fee instead, or keep answering.' : "If you stop now, this session won't count. Treats you earned stay yours."}</p>
            <div className="bdg-modal-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setQuitAsk(false)}>Keep going</button>
              {quiz.kind === 'fee'
                ? <button type="button" className="btn btn-lg" disabled={student.coins < DROP_FEE_CENTS} onClick={() => { setQuitAsk(false); setQuiz(null); recordTransaction(student.id, -DROP_FEE_CENTS, `Buff Doge's drop-off fee`, '🏋️', 'purchase-pet'); playCashRegister(); settleFee(); }}>Pay {formatMoney(DROP_FEE_CENTS)} instead</button>
                : <button type="button" className="btn btn-lg" onClick={() => { setQuitAsk(false); const q = quiz; setQuiz(null); if (q.paid) desk(q.petId); else picker(); }}>Stop the session</button>}
            </div>
          </div>
        </div>
      )}
      <TurnSideways game="Buff Doge's Gym" />
    </div>
  );
}

// Buff Doge asks the training questions himself (her 2026-10-12 art: Buff Doge big on the left,
// the question in his speech bubble, the answers in 4 boxes, or 2 when there are only 2). Her
// style sheet: "Use this font for Buff Doge's text bubble and options".
// Her rules (Build Queue 149, 2026-10-14): "ensure clear next button exsists when question is answered.
// make sure if a question is answered incorrectly on first attempt, that all other question answers
// become view only and are locked from student click. the only thing that should happen should be a next
// question button appears ... ensure that images for questions are zoom in ability to see properly".
// One tap answers: right or wrong, every answer locks and a big Next button appears. A wrong answer
// never counts toward the correct meter. Tap the picture to see it big and zoom in.
function DogeQuiz({ quiz, tts, onRight, onWrong, onSkip }: { quiz: Quiz; tts: Parameters<typeof speak>[1]; onRight: () => void; onWrong: () => void; onSkip: () => void }) {
  const q = quiz.q;
  const order = useMemo(() => { const o = q.choices.map((_, i) => i); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }, [q]);
  const [picked, setPicked] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const right = picked === q.correctIndex;
  const listen = () => speak(`${q.prompt} ${order.map((i) => q.choices[i]).join(', ')}`, tts);
  const qlog = useQLog("Buff Doge's Gym");
  useEffect(() => { qlog.show(q.prompt, q.choices[q.correctIndex] ?? ''); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const pick = (i: number) => {
    if (picked !== null) return;
    qlog.tap(q.choices[i], i === q.correctIndex);
    setPicked(i);
    if (i === q.correctIndex) recordStreakCorrect(); else onWrong();
  };
  return (
    <>
      <div className="bdg-bubble big bdg-qbubble" role="group" aria-label="Buff Doge's question">
        {q.imageUrl && (
          <button type="button" className="bdg-qimg-btn" onClick={() => setZoom(1)} aria-label="Make the picture bigger">
            <img src={q.imageUrl} alt={q.imageAlt ?? ''} className="bdg-qimg" /><span aria-hidden>🔍</span>
          </button>
        )}
        <p>{q.prompt}</p>
        <div className="bdg-qside">
          <button type="button" className="bdg-listen" onClick={listen} aria-label="Listen to the question">🔊</button>
        </div>
      </div>
      <div className={`bdg-options bdg-qopts${q.choices.length <= 2 ? ' two' : ''}${picked !== null ? ' locked' : ''}`}>
        {order.map((i) => (
          <button key={i} type="button" className={`bdg-btn${picked === i ? (right ? ' right' : ' wrong') : ''}`} disabled={picked !== null} aria-disabled={picked !== null} onClick={() => pick(i)}>{q.choices[i]}</button>
        ))}
      </div>
      <div className="bdg-qtools">
        {picked !== null && (
          <span className={`bdg-qresult ${right ? 'ok' : 'no'}`} role="status">{right ? '✅ Correct!' : 'Not this time.'}</span>
        )}
        {picked !== null && <button type="button" className="bdg-btn bdg-next" onClick={() => (right ? onRight() : onSkip())}>Next question ▶</button>}
        {picked === null && <button type="button" className="bdg-btn" onClick={() => openCheckOnPet('break')}>Take a break</button>}
      </div>
      {zoom !== null && q.imageUrl && createPortal(
        <div className="bdg-zoom" role="dialog" aria-label="The question picture, big" onClick={() => setZoom(null)}>
          <div className="bdg-zoom-bar" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn btn-lg" onClick={() => setZoom((z) => Math.max(1, (z ?? 1) - 0.5))} disabled={zoom <= 1} aria-label="Zoom out">➖</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" className="btn btn-lg" onClick={() => setZoom((z) => Math.min(4, (z ?? 1) + 0.5))} disabled={zoom >= 4} aria-label="Zoom in">➕</button>
            <button type="button" className="btn btn-lg btn-primary" onClick={() => setZoom(null)} aria-label="Close the picture">✕</button>
          </div>
          <div className="bdg-zoom-scroll" onClick={(e) => e.stopPropagation()}>
            <img src={q.imageUrl} alt={q.imageAlt ?? ''} style={{ width: `${zoom * 100}%` }} onDoubleClick={() => setZoom((z) => ((z ?? 1) >= 2 ? 1 : 2))} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
