import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { AvatarGlyph } from '../../components/AvatarGlyph';
import ChatPanel from '../../components/ChatPanel';
import type { StudentStatus } from '../../types';

const STATUS_META: Record<StudentStatus, { label: string; dot: string }> = {
  'not-started': { label: 'Not started yet', dot: 'status-idle' },
  working: { label: 'Working', dot: 'status-working' },
  'done-for-day': { label: 'Done for today', dot: 'status-done' },
};

export default function TeacherHome() {
  const navigate = useNavigate();
  // Subscribe to the whole store: this overview must live-update whenever
  // ANY student's help/progress state changes, not just when the fields
  // destructured here happen to change reference.
  const store = useStore();
  const { role, setRole, students, studentStatus, helpPings } = store;
  const [chatStudentId, setChatStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'teacher') setRole('teacher');
  }, [role, setRole]);

  return (
    <div className="app-shell">
      <TeacherNav />
      {chatStudentId && <ChatPanel studentId={chatStudentId} role="teacher" onClose={() => setChatStudentId(null)} />}
      <div className="container stack">
        <div className="space-between" style={{ alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Live Class Overview</h1>
        </div>
        {students.length === 0 && (
          <div className="chrome-frame" style={{ padding: 24 }}>
            <p>No students yet.</p>
            <button className="btn btn-primary" onClick={() => navigate('/teacher/students')}>
              ➕ Add your first student
            </button>
          </div>
        )}
        <div className="stack">
          {students.map((st) => {
            const status = studentStatus(st.id);
            const meta = STATUS_META[status];
            const openPing = helpPings.find((h) => h.studentId === st.id && !h.resolved);
            return (
              <div key={st.id} className="chrome-frame space-between" style={{ padding: 18 }}>
                <div className="row">
                  <span className="avatar-sm" style={{ width: 60, height: 60 }}><AvatarGlyph value={st.avatar} /></span>
                  <div>
                    <div className="row">
                      <strong>{st.name}</strong>
                      <span className={`status-dot ${meta.dot}`} />
                      <span style={{ fontSize: '0.9rem' }}>{meta.label}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                      🔥 {st.streak}-day streak
                      {openPing && <span style={{ color: 'var(--danger)', fontWeight: 700 }}> · 🙋 needs you</span>}
                    </div>
                  </div>
                </div>
                <div className="row-wrap">
                  <button className="btn btn-sm" onClick={() => setChatStudentId(st.id)}>
                    💬 Chat
                  </button>
                  <button className="btn btn-sm" onClick={() => navigate(`/teacher/bank/${st.id}`)}>
                    🐷 Bank
                  </button>
                  <button className="btn btn-sm" onClick={() => navigate(`/teacher/lesson-plan/${st.id}`)}>
                    📋 Lesson Plan
                  </button>
                  <button className="btn btn-sm" onClick={() => navigate(`/teacher/live/${st.id}`)}>
                    👁️ Live View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {/* Mandatory credit line required by the Basic GUI Bundle license
            (Penzilla Design) — the pack's UI art is used across the app's
            buttons/panels/icons, and its license requires this credit be
            visible somewhere reachable in the project, not just in a code
            comment. Kept small and out of the way since it's not something
            a teacher needs to read, just something that has to be here.
            Second line: the farm animal models (Hen/Cow/Rooster from "Poly
            by Google", Chicken by "jeremy") added to Build Mode's farm
            category are CC-BY licensed via Poly Pizza — attribution
            required, unlike the Quaternius models (Pig, Cow, Crops) in the
            same batch, which are CC0 and need none. Third line: the Castle
            building model (Castle Defense, role 'castle') is CC-BY-4.0
            licensed via Sketchfab — same attribution requirement. Fourth
            line: "Pixel UI Free" (public/pixel-ui/pixel-ui-free/, teacher
            upload 2026-10-01, for Castle Defense's kill effect and future
            pixel-style mini games) is CC-BY-4.0 licensed via itch.io, with
            an exact required credit string per its own LICENSE.txt — used
            verbatim below, not paraphrased. The other three packs from the
            same upload (Craftpix explosions used for the kill effect
            itself, a Pixelkiln UI sample, and a teacher-purchased
            Cyberpunk RPG UI pack by etahoshi) don't require a credit line
            under their own license terms, so none is added for them. */}
        <p style={{ textAlign: 'center', fontSize: '0.7rem', opacity: 0.45, marginTop: 32 }}>
          Graphics created by Penzilla Design
        </p>
        <p style={{ textAlign: 'center', fontSize: '0.7rem', opacity: 0.45, marginTop: 4 }}>
          Farm animal models: "Poly by Google" and jeremy, via Poly Pizza (CC BY)
        </p>
        <p style={{ textAlign: 'center', fontSize: '0.7rem', opacity: 0.45, marginTop: 4 }}>
          Castle model: "Low Poly Castle" by treymill33, via Sketchfab (CC BY 4.0)
        </p>
        <p style={{ textAlign: 'center', fontSize: '0.7rem', opacity: 0.45, marginTop: 4 }}>
          Pixel UI Free by heyheythere - https://heyheythere.itch.io/pixel-ui-free - CC BY 4.0
        </p>
        {/* Slime Chess (2026-10-01): the in-world Chess Set model is
            "Chess Set" by Jarlan Perez via Poly Pizza (CC-BY, attribution
            required). The round table is Quaternius (CC0), and the 2D
            game art (Jelly Chess, Bubble Buttons, a free UI sample used
            non-commercially in this classroom app) needs no credit line. */}
        <p style={{ textAlign: 'center', fontSize: '0.7rem', opacity: 0.45, marginTop: 4 }}>
          Chess Set model by Jarlan Perez, via Poly Pizza (CC BY)
        </p>
        {/* Style costume (2026-10-04): "Cute Alien Character" by Ndevisuals,
            downloaded by the teacher from Sketchfab under the Sketchfab
            Standard license (use inside this project allowed, no resale or
            sharing of the raw file); credited here as a courtesy. */}
        <p style={{ textAlign: 'center', fontSize: '0.7rem', opacity: 0.45, marginTop: 4 }}>
          Space Alien costume: "Cute Alien Character" by Ndevisuals, via Sketchfab
        </p>
      </div>
    </div>
  );
}
