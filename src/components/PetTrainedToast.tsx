import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { milestoneCrossed, tricksUnlockedBetween } from '../lib/petCatalog';

// Pets review (teacher 2026-10-06): training used to happen silently, so
// a student never saw their work help their pet. Now every training
// moment shows a short, non-blocking toast, and a crossed milestone or a
// newly teachable trick is named out loud.
export default function PetTrainedToast() {
  const last = useStore((s) => s.lastPetTraining);
  const currentStudentId = useStore((s) => s.currentStudentId);
  const [shown, setShown] = useState<{ id: string; lines: string[] } | null>(null);

  useEffect(() => {
    if (!last || last.studentId !== currentStudentId) return;
    const names = last.pets.map((p) => p.name);
    const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : 'Your pets';
    const lines = [`🐾 ${who} learned from your ${last.source === 'assignment' ? 'finished work' : 'right answers'}! 🎓 +1 training`];
    for (const p of last.pets) {
      const m = milestoneCrossed(p.before, p.after);
      if (m) lines.push(`${m.icon} ${p.name}: ${m.label}!${m.label === 'Walks with you' ? ' Set it as your companion at home.' : ''}`);
      const tricks = tricksUnlockedBetween(p.before, p.after);
      if (tricks.length) lines.push(`🎪 ${p.name} can learn ${tricks.map((t) => t.label).join(', ')} now!`);
    }
    setShown({ id: last.id, lines: lines.slice(0, 4) });
    const t = window.setTimeout(() => setShown((s) => (s?.id === last.id ? null : s)), lines.length > 1 ? 5500 : 3500);
    return () => window.clearTimeout(t);
  }, [last, currentStudentId]);

  if (!shown) return null;
  return (
    <div className="pet-trained-toast" role="status" aria-live="polite">
      {shown.lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}
