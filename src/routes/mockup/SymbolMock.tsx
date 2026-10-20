import { useState } from 'react';
import type { QuizQuestion, SymbolQuestion } from '../../types';
import SymbolSetEditor from '../teacher/SymbolSetEditor';
import SymbolSentenceAnswer from '../../components/SymbolSentenceAnswer';
import { blankSymbolQuestion, sentenceToSlots } from '../../lib/symbolSentence';

// Test page for the symbol sentence builder and answer (Build Queue 253): mockup.html#/symbol
export default function SymbolMock() {
  const [qs, setQs] = useState<QuizQuestion[]>(() => {
    const q = blankSymbolQuestion('m1');
    const slots = sentenceToSlots('The small cat ran quickly.').map((s, i) => (i === 1 || i === 3 ? { ...s, given: false } : s));
    return [{ ...q, slots }];
  });
  const [res, setRes] = useState('');
  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <SymbolSetEditor questions={qs} onChange={setQs} />
      <div style={{ border: '2px solid #ccc', borderRadius: 12, padding: 16 }}>
        <SymbolSentenceAnswer q={qs[0] as SymbolQuestion} disabled={false} onResult={(c, s) => setRes(`${c ? 'right' : 'after fixing'}: ${s}`)} />
        <p id="res">{res}</p>
      </div>
    </div>
  );
}
