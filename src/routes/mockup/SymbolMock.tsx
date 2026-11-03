import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { QuizQuestion, SymbolQuestion } from '../../types';
import SymbolSetEditor from '../teacher/SymbolSetEditor';
import QuestionScreen from '../../components/QuestionScreen';
import { blankSymbolQuestion, punctSlot, sentenceToSlots } from '../../lib/symbolSentence';

// Test page for symbol sentence questions (Build Queue 253, rebuilt by 494): mockup.html#/symbol shows the teacher's
// builder; #/symbol?v=1, 2 or 3 shows a student question like her three mockups (everything open; symbols given and
// every word open; "The" and "climbed" given).
const variant = (v: string): SymbolQuestion => {
  const q = blankSymbolQuestion(`v${v}`);
  if (v === '1') return { ...q, prompt: 'Build your own sentence.' };
  if (v === '4') return { ...q, slots: sentenceToSlots('The happy little brown dog ran very quickly to the park!').map((s, i) => (i % 2 ? { ...s, given: false } : s)) };
  const slots = sentenceToSlots('The small cat climbed.').map((s) => (s.pos === 'punctuation' ? punctSlot(s.word, false) : s));
  if (v === '2') return { ...q, slots: slots.map((s) => (s.pos === 'punctuation' ? s : { ...s, given: false })) };
  return { ...q, slots: slots.map((s, i) => (s.pos === 'punctuation' || i === 0 || i === 3 ? s : { ...s, given: false })) };
};

export default function SymbolMock() {
  const v = new URLSearchParams(useLocation().search).get('v');
  const [qs, setQs] = useState<QuizQuestion[]>(() => {
    const q = blankSymbolQuestion('m1');
    const slots = sentenceToSlots('The small cat ran quickly.').map((s, i) => (i === 1 || i === 3 ? { ...s, given: false } : s));
    return [{ ...q, slots }, blankSymbolQuestion('m2')];
  });
  const [res, setRes] = useState('');
  if (v) {
    const q = variant(v);
    return (
      <>
        <QuestionScreen prompt={q.prompt} choices={[]} correctIndex={-1} done={0} total={5} typed={q} onCorrectAnswer={() => setRes('right')} onWrongAnswer={() => setRes('wrong')} onExit={() => setRes('exit')} />
        <p id="res" style={{ position: 'fixed', bottom: 0, left: 0, zIndex: 999 }}>{res}</p>
      </>
    );
  }
  return (
    <div style={{ padding: 16, display: 'grid', gap: 16, maxWidth: 1180, margin: '0 auto' }}>
      <SymbolSetEditor questions={qs} onChange={setQs} />
    </div>
  );
}
