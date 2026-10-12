import { useRef, useState } from 'react';
import { feedFromInventory } from '../lib/petFood';
import { useStore } from '../store/store';
import type { StudentPet, SelZone } from '../types';
import { petDefById } from '../lib/petCatalog';
import { petFeeling, PET_REPLY, ageForTraining, AGE_LABEL } from '../lib/petsV2';
import { SEL_ZONE_COLORS, SEL_ZONE_LABELS } from '../lib/selZones';
import SelZoneEmotionPicker from './SelZoneEmotionPicker';
import { PetPortrait } from '../routes/student/PetFinder';
import { useTrickSessions, isLearned } from '../lib/petGym';
import { startRecording, playSqueaky, sayInPetVoice, petVoiceLine, type Recording } from '../lib/petSpeak';

// Talking with your pet (her Pets v2 spec, 2026-10-11): "Social bar can be filled by having
// conversations with your pet (pie menu)" and "Pets have same ABA/zones of regulation emotion
// system as players". The pet says how it feels in Zones words, the student can tell the pet how
// they feel, and the pet answers with a calming tool, the same check-in students know.
type Step = 'menu' | 'feeling' | 'you' | 'reply' | 'done';

export default function PetTalk({ pet, onClose, onCue }: { pet: StudentPet; onClose: () => void; onCue?: (kind: string) => void }) {
  const carePet = useStore((s) => s.carePet);
  const def = petDefById(pet.petDefId);
  const name = pet.customName || def?.name || 'Your pet';
  const feel = petFeeling(pet);
  const [step, setStep] = useState<Step>('menu');
  const [said, setSaid] = useState<string>(`Hi! It's me, ${name}!`);
  const [talked, setTalked] = useState(false);
  // Talking Ben (her spec): a pet that learned Speak repeats what you say in a squeaky voice, or
  // answers with something silly of its own.
  const canSpeak = isLearned(useTrickSessions(pet.id), 'Speak');
  const rec = useRef<Recording | null>(null);
  const [recording, setRecording] = useState(false);
  const talkToPet = async () => {
    if (recording && rec.current) {
      setRecording(false);
      const r = await rec.current.stop(); rec.current = null;
      counted();
      if (r.blob && r.voiced > 0.4 && Math.random() < 0.65) { setSaid('🎤 ...'); await playSqueaky(r.blob); setSaid(`*${name} says it right back to you!*`); }
      else { const line = petVoiceLine(pet.petDefId); setSaid(line); sayInPetVoice(line); }
      onCue?.('wiggle');
      return;
    }
    try { rec.current = await startRecording(false); setRecording(true); setSaid(`I'm listening! Say something to me...`); }
    catch { setSaid(`I can't hear you. The microphone is not on.`); }
  };

  // One conversation fills Social once.
  const counted = () => { if (!talked) { carePet(pet.id, 'talk'); setTalked(true); } };
  const act = (kind: 'feed' | 'pet' | 'play', line: string) => {
    // Food comes from the student's own pet food (her rule 2026-10-12: buy it or earn it).
    if (kind === 'feed') {
      const food = feedFromInventory(pet.studentId, pet.id);
      if (!food) { setSaid(`I'm hungry, but we don't have any pet food. You can buy some in the Marketplace, or earn it in Farm Grow and Doc Fishing.`); return; }
      line = `Yum! Thank you for the ${food.name.toLowerCase()}!`;
    } else carePet(pet.id, kind);
    onCue?.(kind === 'pet' ? 'wiggle' : 'hop'); setSaid(line); setStep('done');
  };

  return (
    <div className="pet-talk-backdrop" role="dialog" aria-modal="true" aria-label={`Talk with ${name}`} onClick={onClose}>
      <div className="pet-talk" onClick={(e) => e.stopPropagation()}>
        <div className="pet-talk-pet">
          <PetPortrait defId={pet.petDefId} size={150} alt={name} />
          <strong>{name}</strong>
          <span className="pet-talk-sub">{AGE_LABEL[ageForTraining(pet.trainingProgress)]} {def?.name}</span>
          <span className="pet-talk-zone" style={{ background: SEL_ZONE_COLORS[feel.zone] }}>{feel.face} {feel.emotion}, {SEL_ZONE_LABELS[feel.zone]} Zone</span>
        </div>
        <div className="pet-talk-side">
          <div className="pet-talk-bubble" aria-live="polite">{said}</div>
          {step === 'menu' && (
            <div className="pet-talk-choices">
              <button type="button" className="btn btn-lg" onClick={() => { setSaid(feel.says); setStep('feeling'); counted(); }}>How are you feeling?</button>
              <button type="button" className="btn btn-lg" onClick={() => { setSaid(`Thanks for asking! How are YOU feeling?`); setStep('you'); counted(); }}>Tell {name} how I feel</button>
              <button type="button" className="btn btn-lg" onClick={() => act('feed', `Yum! Thank you for the snack!`)}>Feed</button>
              <button type="button" className="btn btn-lg" onClick={() => act('pet', `That feels so nice. I love you!`)}>Pet</button>
              <button type="button" className="btn btn-lg" onClick={() => act('play', `Woohoo! That was so much fun!`)}>Play</button>
              {canSpeak && <button type="button" className={`btn btn-lg${recording ? ' btn-primary' : ''}`} onClick={talkToPet}>{recording ? 'Done talking' : `Talk to ${name}`}</button>}
            </div>
          )}
          {step === 'feeling' && (
            <div className="pet-talk-choices">
              {feel.need === 'feed' && <button type="button" className="btn btn-lg btn-primary" onClick={() => act('feed', `Thank you! My tummy feels much better. I am back in the Green Zone.`)}>Here's a snack</button>}
              {feel.need === 'pet' && <button type="button" className="btn btn-lg btn-primary" onClick={() => act('pet', `Thank you. That cuddle helped a lot.`)}>Give a cuddle</button>}
              {feel.need === 'play' && <button type="button" className="btn btn-lg btn-primary" onClick={() => act('play', `Yay! Playing with you always cheers me up!`)}>Let's play!</button>}
              <button type="button" className="btn btn-lg" onClick={() => { setSaid(`Thanks for asking! How are YOU feeling?`); setStep('you'); }}>Tell {name} how I feel</button>
              <button type="button" className="btn btn-lg" onClick={() => { setSaid(`Thanks for talking with me!`); setStep('done'); }}>Bye for now</button>
            </div>
          )}
          {step === 'you' && (
            <div className="pet-talk-picker">
              <SelZoneEmotionPicker hideQuestion onPick={(zone: SelZone, emotion: string) => {
                const lines = PET_REPLY[zone];
                setSaid(`You feel ${emotion.toLowerCase()}. ${lines[Math.floor(Math.random() * lines.length)]}`);
                setStep('reply');
              }} />
            </div>
          )}
          {(step === 'reply' || step === 'done') && (
            <div className="pet-talk-choices">
              <button type="button" className="btn btn-lg btn-primary" onClick={onClose}>Thanks, {name}!</button>
              {step === 'reply' && <button type="button" className="btn btn-lg" onClick={() => { setSaid(`What else should we do?`); setStep('menu'); }}>More</button>}
            </div>
          )}
          {talked && <p className="pet-talk-note">💞 {name}'s Social bar went up from talking with you.</p>}
        </div>
        <button type="button" className="pet-talk-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
    </div>
  );
}
