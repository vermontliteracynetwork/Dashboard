import { useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
import TicketStub from '../../components/TicketStub';
import type { Student, Task } from '../../types';

interface Props {
  student: Student;
  task: Task;
  onDone: () => void;
}

export default function DrillTask({ student, task, onDone }: Props) {
  const cards = task.drill?.cards ?? [];
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (cards.length === 0) {
    return (
      <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <p>This drill has no cards yet. Ask your teacher!</p>
        <button className="btn btn-primary btn-lg" onClick={onDone}>I'm done!</button>
      </div>
    );
  }

  const card = cards[index];
  const isLast = index === cards.length - 1;

  return (
    <div className="stack">
      <TicketStub remaining={cards.length - index} total={cards.length} label="cards left" />
      <div className="content-well stack" style={{ alignItems: 'center' }}>
        <div className="row">
          <h3 style={{ margin: 0 }}>{task.title}</h3>
          <ReadAloud text={flipped ? card.back : card.front} settings={student.ttsSettings} />
        </div>
        <div className="flashcard" onClick={() => setFlipped((f) => !f)}>
          <div>
            {card.imageUrl && (
              <img src={card.imageUrl} alt="" style={{ maxWidth: 140, maxHeight: 140, borderRadius: 10, marginBottom: 10 }} />
            )}
            <div>{flipped ? card.back : card.front}</div>
          </div>
        </div>
        <p className="flashcard-hint">Tap the card to {flipped ? 'see the front' : 'flip it over'}</p>
        <button
          className="btn btn-primary btn-lg pulse-cta"
          onClick={() => {
            if (isLast) {
              onDone();
            } else {
              setIndex((i) => i + 1);
              setFlipped(false);
            }
          }}
        >
          {isLast ? '✅ Finish' : '➡️ Next card'}
        </button>
      </div>
    </div>
  );
}
