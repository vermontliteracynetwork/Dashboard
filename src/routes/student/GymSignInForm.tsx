import { useMemo, useState } from 'react';
import type { StudentPet, TTSSettings } from '../../types';
import { PET_CATALOG, petDefById } from '../../lib/petCatalog';
import { SESSION_MINUTES, SESSION_QUESTIONS, type TrickDef } from '../../lib/petGym';
import { formatMoney } from '../../lib/money';
import { speak } from '../../components/ReadAloud';

// Buff Doge's Gym sign-in, as a real form the student walks through (her words, 2026-10-12: "make the
// sign in like a form students have to walk through, typing info and stuff to seem more real and help
// with the aba elements. make sure its friendly for autistic middle schoolers", then "make sure the
// form selects what skill they are training, confrim payment features, etc."). Built for her students:
// one question on each page, the same layout every page, a step counter, an example under each typing
// box, a Listen on every page, kind and exact help when something is not right yet (never a buzzer,
// never a timer), a Show me hint, and Back on every page.

export type PayWay = 'money' | 'questions' | 'read';
interface Props {
  ownerName: string; coins: number; pet: StudentPet; tricks: TrickDef[]; recommended?: string; sessions: Record<string, number>;
  tts?: TTSSettings; onCancel: () => void; onDone: (trick: string, pay: PayWay) => void;
}
const STEPS = ['Your name', 'Pet name', 'Animal', 'Trick', 'Payment', 'Gym rules', 'Check and confirm'];

export default function GymSignInForm({ ownerName, coins, pet, tricks, recommended, sessions, tts, onCancel, onDone }: Props) {
  const first = ownerName.trim().split(/\s+/)[0] ?? '';
  const def = petDefById(pet.petDefId);
  const kinds = useMemo(() => {
    const others = PET_CATALOG.filter((p) => p.name !== def?.name).sort(() => Math.random() - 0.5).slice(0, 2).map((p) => p.name);
    return [def?.name ?? 'My pet', ...others].sort(() => Math.random() - 0.5);
  }, [def?.name]);
  const [step, setStep] = useState(0);
  const [owner, setOwner] = useState('');
  const [petName, setPetName] = useState('');
  const [kind, setKind] = useState<string | null>(null);
  const [trick, setTrick] = useState<string | null>(recommended ?? null);
  const [pay, setPay] = useState<PayWay | null>(null);
  const [rules, setRules] = useState([false, false, false]);
  const [help, setHelp] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const t = tricks.find((x) => x.name === trick);
  const cost = t?.costCents ?? 0;
  const after = coins - cost;

  // Typed names: same letters as the real name, starting with a capital letter.
  const nameHelp = (typed: string, real: string, who: string) => {
    const v = typed.trim();
    if (!v) return `Type ${who} in the box.`;
    if (v.toLowerCase() !== real.toLowerCase()) return `Check the spelling. ${who[0].toUpperCase()}${who.slice(1)} is spelled ${real.split('').join(' ')}.`;
    if (v[0] !== v[0].toUpperCase()) return `Names start with a capital letter. Try ${real}.`;
    return null;
  };
  const prompts = [
    `Hi! Type your first name in the box.`,
    `Type your pet's name in the box.`,
    `What kind of animal is ${pet.customName}? Tap one.`,
    `Which trick will ${pet.customName} train today? Tap one.`,
    `How will you pay for this session? Tap one.`,
    `Read each gym rule. Tap the box next to each one to agree.`,
    `Check your form. If it is all right, tap Confirm.`,
  ];
  const problem = (): string | null => {
    if (step === 0) return nameHelp(owner, first, 'your first name');
    if (step === 1) return nameHelp(petName, pet.customName, "your pet's name");
    if (step === 2) return !kind ? 'Tap the kind of animal.' : kind !== def?.name ? `Look at ${pet.customName} again. Try a different one.` : null;
    if (step === 3) return trick ? null : 'Tap a trick to train.';
    if (step === 4) return !pay ? 'Tap a way to pay.' : pay === 'money' && coins < cost ? `You have ${formatMoney(coins)}. That is not enough for ${formatMoney(cost)}. Pick answering questions instead.` : null;
    if (step === 5) return rules.every(Boolean) ? null : 'Tap every box to agree to the rules.';
    return null;
  };
  const next = () => {
    const p = problem();
    if (p) { setHelp(p); return; }
    setHelp(null); setHint(false);
    if (step < STEPS.length - 1) setStep(step + 1); else setReceipt(true);
  };
  const backStep = () => { setHelp(null); setHint(false); if (step === 0) onCancel(); else setStep(step - 1); };
  const payLabel = pay === 'money' ? `Pay ${formatMoney(cost)} now. Pick up ${pet.customName} in ${SESSION_MINUTES} minutes.` : pay === 'questions' ? `Answer ${SESSION_QUESTIONS} questions with Buff Doge now.` : pay === 'read' ? 'Read 2 passages aloud in the Library, for free.' : '';
  const RULES = [
    'Only one pet can train at the gym at a time.',
    `I will pick up ${pet.customName} when training is done.`,
    'If I leave while my pet is training, there is a drop-off fee: $100 or 25 questions.',
  ];

  if (receipt) {
    const line = pay === 'money' ? `Paid ${formatMoney(cost)}. Your money went from ${formatMoney(coins)} to ${formatMoney(after)}.` : pay === 'questions' ? `Paid with ${SESSION_QUESTIONS} questions. They start next.` : 'Paid by reading 2 passages in the Library.';
    return (
      <div className="gsf-back" role="dialog" aria-modal="true" aria-label="Gym receipt">
        <div className="gsf-card gsf-receipt">
          <h2>Receipt</h2>
          <p className="gsf-sub">Buff Doge's Gym</p>
          <dl>
            <dt>Owner</dt><dd>{owner.trim()}</dd>
            <dt>Pet</dt><dd>{pet.customName} ({def?.name})</dd>
            <dt>Trick</dt><dd>{trick}, session {(sessions[trick ?? ''] ?? 0) + 1} of {t?.sessions}</dd>
            <dt>Payment</dt><dd>{line}</dd>
          </dl>
          <p className="gsf-thanks">Thank you! {pet.customName} is signed in.</p>
          <div className="gsf-row">
            <button type="button" className="btn btn-lg gsf-listen" onClick={() => speak(`Receipt. ${pet.customName}, ${trick}. ${line} Thank you!`, tts)} aria-label="Listen">🔊</button>
            <button type="button" className="btn btn-primary btn-lg gsf-next" onClick={() => onDone(trick!, pay!)}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gsf-back" role="dialog" aria-modal="true" aria-label="Gym sign-in form">
      <div className="gsf-card">
        <div className="gsf-top">
          <h2>Gym sign-in form</h2>
          <span className="gsf-count">Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
        </div>
        <div className="gsf-progress" aria-hidden><i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="gsf-prompt">
          <p>{prompts[step]}</p>
          <button type="button" className="btn gsf-listen" onClick={() => speak(prompts[step], tts)} aria-label="Listen">🔊</button>
        </div>

        {step === 0 && (
          <label className="gsf-field">
            <span>First name</span>
            <input value={owner} onChange={(e) => { setOwner(e.target.value); setHelp(null); }} autoComplete="off" autoCapitalize="words" spellCheck={false} onKeyDown={(e) => { if (e.key === 'Enter') next(); }} />
            <small>Example: {hint ? first : 'Sam'}</small>
          </label>
        )}
        {step === 1 && (
          <label className="gsf-field">
            <span>Pet name</span>
            <input value={petName} onChange={(e) => { setPetName(e.target.value); setHelp(null); }} autoComplete="off" autoCapitalize="words" spellCheck={false} onKeyDown={(e) => { if (e.key === 'Enter') next(); }} />
            <small>Example: {hint ? pet.customName : 'Biscuit'}</small>
          </label>
        )}
        {step === 2 && (
          <div className="gsf-choices">
            {kinds.map((k) => <button key={k} type="button" className={`gsf-choice${kind === k ? ' on' : ''}${hint && k === def?.name ? ' hint' : ''}`} onClick={() => { setKind(k); setHelp(null); }}>{k}</button>)}
          </div>
        )}
        {step === 3 && (
          <div className="gsf-choices">
            {tricks.map((x) => (
              <button key={x.name} type="button" className={`gsf-choice${trick === x.name ? ' on' : ''}`} onClick={() => { setTrick(x.name); setPay(null); setHelp(null); }}>
                <b>{x.name}</b>
                <small>{x.name === recommended ? 'Buff Doge recommends this. ' : ''}{sessions[x.name] ?? 0} of {x.sessions} sessions done</small>
              </button>
            ))}
          </div>
        )}
        {step === 4 && t && (
          <div className="gsf-choices">
            <button type="button" className={`gsf-choice${pay === 'money' ? ' on' : ''}`} onClick={() => { setPay('money'); setHelp(null); }}>
              <b>Pay {formatMoney(cost)}</b>
              <small>You have {formatMoney(coins)}. After paying: {formatMoney(after)}. Ready in {SESSION_MINUTES} minutes.</small>
            </button>
            <button type="button" className={`gsf-choice${pay === 'questions' ? ' on' : ''}`} onClick={() => { setPay('questions'); setHelp(null); }}>
              <b>Answer {SESSION_QUESTIONS} questions</b>
              <small>With Buff Doge, right now. No money needed.</small>
            </button>
            {t.name === 'Speak' && (
              <button type="button" className={`gsf-choice${pay === 'read' ? ' on' : ''}`} onClick={() => { setPay('read'); setHelp(null); }}>
                <b>Read 2 passages aloud</b>
                <small>In the Library, for free.</small>
              </button>
            )}
          </div>
        )}
        {step === 5 && (
          <div className="gsf-rules">
            {RULES.map((r, i) => (
              <label key={i} className={`gsf-rule${rules[i] ? ' on' : ''}`}>
                <input type="checkbox" checked={rules[i]} onChange={() => { setRules(rules.map((v, k) => (k === i ? !v : v))); setHelp(null); }} />
                <span>{r}</span>
              </label>
            ))}
          </div>
        )}
        {step === 6 && (
          <dl className="gsf-review">
            <dt>Owner</dt><dd>{owner.trim()}</dd>
            <dt>Pet</dt><dd>{pet.customName} ({kind})</dd>
            <dt>Trick</dt><dd>{trick}</dd>
            <dt>Payment</dt><dd>{payLabel}</dd>
            {pay === 'money' && <><dt>Money</dt><dd>{formatMoney(coins)} now, {formatMoney(after)} after paying</dd></>}
          </dl>
        )}

        {help && <p className="gsf-help" role="alert">{help}</p>}
        <div className="gsf-row">
          <button type="button" className="btn btn-lg gsf-backbtn" onClick={backStep}>{step === 0 ? 'Cancel' : 'Back'}</button>
          {step < 3 && <button type="button" className="btn btn-lg" onClick={() => setHint(true)}>Show me</button>}
          <button type="button" className="btn btn-primary btn-lg gsf-next" onClick={next}>{step === 6 ? (pay === 'money' ? `Confirm and pay ${formatMoney(cost)}` : 'Confirm') : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
