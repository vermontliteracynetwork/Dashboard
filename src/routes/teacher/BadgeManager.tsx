import { useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';

export default function BadgeManager() {
  const badges = useStore((s) => s.badges);
  const students = useStore((s) => s.students);
  const addBadge = useStore((s) => s.addBadge);
  const updateBadge = useStore((s) => s.updateBadge);
  const deleteBadge = useStore((s) => s.deleteBadge);
  const awardBadge = useStore((s) => s.awardBadge);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🌟');
  const [awardStudent, setAwardStudent] = useState('');
  const [awardBadgeId, setAwardBadgeId] = useState('');

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>Badges</h1>

        <div className="chrome-frame stack" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>➕ New Badge</h3>
          <div className="row-wrap">
            <input placeholder="Icon (emoji)" style={{ width: 70 }} value={icon} onChange={(e) => setIcon(e.target.value)} />
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <button
              className="btn btn-primary"
              disabled={!name.trim()}
              onClick={() => {
                addBadge({ name: name.trim(), description: description.trim(), icon: icon.trim() || '🌟' });
                setName('');
                setDescription('');
              }}
            >
              Add
            </button>
          </div>
        </div>

        <div className="stack">
          {badges.map((b) => (
            <div key={b.id} className="chrome-frame space-between" style={{ padding: 14 }}>
              <div className="row" style={{ flex: 1 }}>
                <span style={{ fontSize: '1.8rem' }}>{b.icon}</span>
                <input value={b.name} onChange={(e) => updateBadge(b.id, { name: e.target.value })} />
                <input value={b.description} onChange={(e) => updateBadge(b.id, { description: e.target.value })} style={{ flex: 1 }} />
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => deleteBadge(b.id)}>Delete</button>
            </div>
          ))}
        </div>

        <div className="chrome-frame stack" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>🎁 Award a Badge</h3>
          <div className="row-wrap">
            <select value={awardStudent} onChange={(e) => setAwardStudent(e.target.value)}>
              <option value="">Choose a student</option>
              {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
            <select value={awardBadgeId} onChange={(e) => setAwardBadgeId(e.target.value)}>
              <option value="">Choose a badge</option>
              {badges.map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
            </select>
            <button
              className="btn btn-primary"
              disabled={!awardStudent || !awardBadgeId}
              onClick={() => awardBadge(awardStudent, awardBadgeId)}
            >
              Award
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
