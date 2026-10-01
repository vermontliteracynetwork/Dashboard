import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { AvatarGlyph } from '../../components/AvatarGlyph';
import SelZoneCheckIn from '../../components/SelZoneCheckIn';

export default function StudentLogin() {
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const loginStudent = useStore((s) => s.loginStudent);
  // Zones of Regulation mandatory check-in (docs/ZONES_OF_REGULATION_CHECKIN.md)
  // — fires on every avatar tap, before the world ever loads. Set the
  // instant a student is tapped; navigation to Town Square happens only
  // once SelZoneCheckIn calls onDone (immediately for Green, after the
  // support menu for any other zone).
  const [checkingInStudent, setCheckingInStudent] = useState<{ id: string; name: string } | null>(null);

  if (checkingInStudent) {
    return (
      <SelZoneCheckIn
        studentId={checkingInStudent.id}
        studentName={checkingInStudent.name}
        onDone={() => navigate('/world/town')}
      />
    );
  }

  return (
    <div className="center-screen">
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', maxWidth: 700 }}>
        <h1 className="display" style={{ color: 'var(--purple)' }}>Who's working today?</h1>
        {students.length === 0 ? (
          <div className="chrome-frame" style={{ padding: 24 }}>
            <p>No students have been set up yet. Ask your teacher to add you on the Teacher side!</p>
            <button className="btn" onClick={() => navigate('/')}>← Back</button>
          </div>
        ) : (
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            {students.map((st) => (
              <button
                key={st.id}
                className="avatar-btn stack"
                style={{ width: 'auto', minWidth: 110, height: 'auto', gap: 6, padding: '16px 18px' }}
                onClick={() => {
                  loginStudent(st.id);
                  setCheckingInStudent({ id: st.id, name: st.name });
                }}
                aria-label={st.name}
                title={st.name}
              >
                <span><AvatarGlyph value={st.avatar} size={56} /></span>
                <span style={{ fontSize: '1rem', fontFamily: "'Baloo 2', sans-serif" }}>{st.name}</span>
              </button>
            ))}
          </div>
        )}
        <button className="btn btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
    </div>
  );
}
