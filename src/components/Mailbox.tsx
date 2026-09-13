import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { QUEST1_NEIGHBORS } from '../lib/worldQuest1';

// The Post Office's 2D view — Claudia's full-game audit found it (and the
// Welcome Center) walkable-up-to and labeled but otherwise inert, which
// reads as broken rather than "not yet built" for literal-thinking
// students. Every Neighbor already grants a themed itemLabel the moment
// they're met (worldQuest1MetIds), paid only as its cash equivalent since
// no placeable-item catalog exists yet for it (see worldQuest1.ts) — this
// just gives that existing data somewhere to actually show up, framed as
// mail Wren delivered, rather than inventing a new mechanic.
export default function Mailbox() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const student = students.find((s) => s.id === currentStudentId);
  if (!student) return null;

  const received = QUEST1_NEIGHBORS.filter((n) => student.worldQuest1MetIds.includes(n.id));

  return (
    <div className="container stack">
      <div className="subject-header space-between" style={{ background: 'linear-gradient(120deg, var(--purple), var(--purple-dark))' }}>
        <h2 style={{ margin: 0, color: '#fff' }}>📬 Mailbox</h2>
        <button className="btn btn-sm" onClick={() => navigate('/student/home')}>🏠 Home</button>
      </div>

      <div className="chrome-frame stack" style={{ padding: 24, maxWidth: 480, alignSelf: 'center', width: '100%' }}>
        {received.length === 0 ? (
          <p style={{ opacity: 0.75, textAlign: 'center' }}>
            Nothing in your mailbox yet. Meet a Neighbor around town and Wren will bring you something!
          </p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {received.map((n) => (
              <div key={n.id} className="checklist-item">
                <span style={{ fontSize: '1.3rem' }}>💌</span>
                <span className="checklist-label" style={{ flex: 1 }}>
                  From {n.name}: {n.itemLabel}
                </span>
              </div>
            ))}
          </div>
        )}
        <p style={{ opacity: 0.6, fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
          Wren delivers whatever a Neighbor sends the first time you meet them.
        </p>
      </div>
    </div>
  );
}
