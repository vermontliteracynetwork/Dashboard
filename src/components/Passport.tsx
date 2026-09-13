import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { AvatarGlyph } from './AvatarGlyph';
import { QUEST1_NEIGHBOR_COUNT } from '../lib/worldQuest1';

// The Welcome Center's 2D view — Scout's whole role is "shows you
// around," so a Town-Hall-style passport (who you are, what you've
// earned) is the on-brand equivalent of Animal Crossing's Town Hall, and
// closes the same "labeled but inert building" gap Mailbox.tsx closes for
// the Post Office (Claudia's full-game audit).
export default function Passport() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const badges = useStore((s) => s.badges);
  const student = students.find((s) => s.id === currentStudentId);
  if (!student) return null;

  const earnedBadges = badges.filter((b) => student.badgeIds.includes(b.id));

  return (
    <div className="container stack">
      <div className="subject-header space-between" style={{ background: 'linear-gradient(120deg, var(--purple), var(--purple-dark))' }}>
        <h2 style={{ margin: 0, color: '#fff' }}>🛂 Passport</h2>
        <button className="btn btn-sm" onClick={() => navigate('/student/home')}>🏠 Home</button>
      </div>

      <div className="chrome-frame stack" style={{ padding: 24, maxWidth: 480, alignSelf: 'center', width: '100%', gap: 20 }}>
        <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
          <div style={{ width: 96, height: 96 }}>
            <AvatarGlyph value={student.avatar} />
          </div>
          <h3 style={{ margin: 0 }}>{student.name}</h3>
        </div>

        <div className="row-wrap" style={{ justifyContent: 'center', gap: 16 }}>
          <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: '1.6rem' }}>🔥</span>
            <strong>{student.streak}</strong>
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>day streak</span>
          </div>
          <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: '1.6rem' }}>🙋</span>
            <strong>{student.worldQuest1MetIds.length}/{QUEST1_NEIGHBOR_COUNT}</strong>
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Neighbors met</span>
          </div>
          <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: '1.6rem' }}>📖</span>
            <strong>{student.worldJokesHeardIds.length}</strong>
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>jokes collected</span>
          </div>
        </div>

        <hr className="divider" />
        <strong>Achievements</strong>
        {earnedBadges.length === 0 ? (
          <p style={{ opacity: 0.75 }}>No badges yet. Keep going!</p>
        ) : (
          <div className="row-wrap">
            {earnedBadges.map((b) => (
              <div className="badge-chip" key={b.id}>
                <span style={{ fontSize: '1.8rem' }}>{b.icon}</span>
                {b.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
