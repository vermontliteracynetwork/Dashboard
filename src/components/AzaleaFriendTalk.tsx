import { useEffect, useRef, useState } from 'react';
import { useVoiceToText } from '../lib/useVoiceToText';
import { NPC_VOICE_PRESETS } from '../lib/npcVoices';
import { speak } from './ReadAloud';
import type { SelZone, TTSSettings } from '../types';

// Talk to Azalea after a feelings check-in (Build Queue 270, her words: "SEL check in, rather than lave note for
// teacher, add the talk to Azalea feature similar to reporting a bug where they can talk." and "Azalea should be the
// person students talk to after emotion check in, not the teacher. give a view of azalea similar to when students
// report a bug, where they can talk to azalea like a friend."). The same Azalea card as Report: her picture, her
// speech bubble read aloud, 🎤 Talk or type. She listens like a friend, one small question at a time: what happened,
// she says back what she heard and names the feeling, offers two of the student's own tools, then asks if there is
// more. Words about being hurt or unsafe get a calm "a grown-up will help" and are marked for the teacher. The whole
// talk is saved on the check-in (the note field), so the teacher and the team report still see it.

const AZ = '/characters/azalea.png';
const VOICE = NPC_VOICE_PRESETS['bright-friendly'];
const SAFETY = ['hurt me', 'hurts me', 'hit me', 'hitting me', 'kick', 'kill', 'die', 'unsafe', 'not safe', 'touch me', 'scared of', 'bully', 'bullied', 'punch', 'hate myself', 'run away'];
const STARTERS: Record<SelZone, string[]> = {
  blue: ['I feel tired because ___.', 'I miss ___.', 'Nobody ___.'],
  green: ['I feel good because ___.', 'My favorite part was ___.'],
  yellow: ['It was hard when ___.', 'I got upset because ___.', 'I am worried about ___.'],
  red: ['I got really mad when ___.', 'I need ___.', 'I want a break because ___.'],
};

type Line = { who: 'Azalea' | 'Me'; text: string };

export default function AzaleaFriendTalk({ name, feeling, zone, tools, tts, onToolTap, onDone, onClose }: {
  name: string; feeling?: string; zone: SelZone; tools: string[]; tts?: TTSSettings;
  onToolTap: (label: string) => void; onDone: (transcript: string) => void; onClose: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [step, setStep] = useState(0); // 0 what happened, 1 tools, 2 anything else, 3 done
  const [draft, setDraft] = useState('');
  const [flag, setFlag] = useState(false);
  const linesRef = useRef<Line[]>([]);
  const voice = useVoiceToText((heard) => setDraft((d) => (d ? `${d} ${heard}` : heard)), { continuous: false });
  const feel = (feeling ?? '').toLowerCase();

  const azalea = (text: string) => {
    linesRef.current = [...linesRef.current, { who: 'Azalea', text }]; setLines(linesRef.current);
    speak(text, tts, undefined, VOICE);
  };
  useEffect(() => {
    azalea(`Hi ${name}, it's Azalea. ${feel ? `You feel ${feel}. ` : ''}That is okay to feel. I am here to listen. Do you want to tell me what happened?`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const two = tools.slice(0, 2);
  const send = () => {
    const said = draft.trim(); if (!said) return;
    voice.stop(); setDraft('');
    linesRef.current = [...linesRef.current, { who: 'Me', text: said }]; setLines(linesRef.current);
    const unsafe = SAFETY.some((w) => said.toLowerCase().includes(w));
    if (unsafe) setFlag(true);
    window.setTimeout(() => {
      if (unsafe) { azalea('Thank you for telling me. That sounds really important. I will make sure your teacher knows, so a grown-up can help you and keep you safe.'); setStep(2); return; }
      if (step === 0) {
        azalea(`Thank you for telling me. I heard you say: "${said.length > 80 ? `${said.slice(0, 80)}...` : said}". ${feel ? `Feeling ${feel} makes sense.` : 'That makes sense.'} ${two.length ? `Do you want to try ${two.join(' or ')}?` : 'Is there anything else?'}`);
        setStep(two.length ? 1 : 2);
      } else {
        azalea('You are doing a great job using your words. Is there anything else you want to tell me?');
        setStep(2);
      }
    }, 450);
  };
  const tryTool = (t: string) => { onToolTap(t); linesRef.current = [...linesRef.current, { who: 'Me', text: `I will try: ${t}` }]; setLines(linesRef.current); window.setTimeout(() => { azalea(`Great choice. ${t} can really help. Is there anything else you want to tell me?`); setStep(2); }, 350); };
  const finish = () => {
    voice.stop();
    azalea(`Thanks for talking with me, ${name}. I am always here when you want to talk. Your teacher can read what we said, so they can help too.`);
    setStep(3);
    const text = linesRef.current.map((l) => `${l.who === 'Me' ? name : 'Azalea'}: ${l.text}`).join('\n');
    onDone(`${flag ? '⚠️ Safety words, please check in with the student.\n' : ''}Talked with Azalea:\n${text}`);
  };
  const last = [...lines].reverse().find((l) => l.who === 'Azalea')?.text ?? '';

  return (
    <div className="pf-overlay report-back" onClick={(e) => e.stopPropagation()}>
      <div className="pf-panel report-card az azf" role="dialog" aria-label="Talk to Azalea">
        <img className="az-cat" src={AZ} alt="Azalea the cat" />
        <div className="az-main">
          <div className="az-top">
            <b className="azf-title">🐱 Talking with Azalea</b>
            <button type="button" className="btn report-listen" onClick={() => { voice.stop(); if (step < 3 && lines.some((l) => l.who === 'Me')) finish(); onClose(); }} aria-label="Close">✕</button>
          </div>
          <div className="az-say" role="status">
            <b>Azalea</b>
            <p>{last}</p>
            <button type="button" className="btn report-listen" onClick={() => speak(last, tts, undefined, VOICE)} aria-label="Listen to Azalea">🔊</button>
          </div>
          {lines.filter((l) => l.who === 'Me').length > 0 && (
            <div className="azf-log" aria-label="What I said">{lines.filter((l) => l.who === 'Me').map((l, i) => <p key={i}>{l.text}</p>)}</div>
          )}
          {step === 1 && two.length > 0 && (
            <div className="az-choices">{two.map((t) => <button key={t} type="button" className="az-choice" onClick={() => tryTool(t)}><span aria-hidden>🧰</span>{t}</button>)}</div>
          )}
          {step < 3 && (
            <>
              {step === 0 && <div className="az-frames" aria-label="Sentence starters">{STARTERS[zone].map((f) => <button key={f} type="button" className="az-frame" onClick={() => setDraft((d) => (d ? `${d} ${f}` : f))}>{f}</button>)}</div>}
              <label className="report-field">
                <span>Tell Azalea</span>
                <textarea value={draft} rows={2} onChange={(e) => setDraft(e.target.value)} placeholder={STARTERS[zone][0]} />
              </label>
              <div className="az-tools">
                {voice.supported && <button type="button" className={`az-tool${voice.listening ? ' live' : ''}`} onClick={voice.toggle}>{voice.listening ? '⏹️ Stop' : '🎤 Talk'}</button>}
                <button type="button" className="az-tool" disabled={!draft.trim()} onClick={send}>💬 Tell her</button>
                {step === 2 && <button type="button" className="az-tool" onClick={finish}>👍 That's all</button>}
              </div>
              {voice.error === 'denied' && <p className="az-note">The microphone is turned off. You can type instead.</p>}
            </>
          )}
          {step === 3 && <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  );
}
