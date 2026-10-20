import { useState } from 'react';
import { SEL_ZONE_COLORS } from '../lib/selZones';
import type { SelZone } from '../types';
import { useStore } from '../store/store';
import AzaleaFriendTalk from './AzaleaFriendTalk';

// Support menu shown after picking any non-Green zone+emotion — the tools
// board, Talk to Azalea (Build Queue 270, was a note to the teacher), and a breathing circle
// that appears the moment a breathing-related tool is tapped. Used both by
// the login check-in and every later Neighbor re-check (same component, per
// spec §3's "same inline tools board").
export default function SelSupportMenu({
  zone,
  tools,
  onToolTap,
  onNoteSave,
  feeling,
}: {
  zone: SelZone;
  tools: string[];
  onToolTap: (label: string) => void;
  onNoteSave: (text: string) => void;
  feeling?: string;
}) {
  const [tapped, setTapped] = useState<string[]>([]);
  const [showBreathing, setShowBreathing] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));

  const tapTool = (label: string) => {
    setTapped((prev) => [...prev, label]);
    onToolTap(label);
    if (/breath/i.test(label)) setShowBreathing(true);
  };

  return (
    <div className="stack sel-support-menu" style={{ gap: 14 }}>
      {tools.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <p className="sel-picker-subtext" style={{ margin: 0, fontWeight: 700 }}>Here are some tools that might help:</p>
          <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
            {tools.map((tool) => (
              <button
                key={tool}
                className="sel-tool-btn"
                style={{ borderColor: SEL_ZONE_COLORS[zone] }}
                onClick={() => tapTool(tool)}
              >
                {tapped.includes(tool) ? '✓ ' : ''}{tool}
              </button>
            ))}
          </div>
        </div>
      )}

      {showBreathing && (
        <div className="stack" style={{ alignItems: 'center', gap: 6 }}>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Breathe in as the circle grows. Breathe out as it shrinks.</p>
          <div className="breathe-circle" />
        </div>
      )}

      {/* Build Queue 270: students talk to Azalea like a friend instead of leaving a note for the teacher. */}
      {noteSaved ? (
        <p style={{ textAlign: 'center', fontSize: '0.9rem' }}>✓ You talked with Azalea.</p>
      ) : (
        <button className="btn btn-primary" style={{ minHeight: 52 }} onClick={() => setNoteOpen(true)}>
          🐱 Talk to Azalea
        </button>
      )}
      {noteOpen && student && (
        <AzaleaFriendTalk name={student.name.split(' ')[0]} feeling={feeling} zone={zone} tools={tools} tts={student.ttsSettings}
          onToolTap={tapTool} onDone={(t) => { onNoteSave(t); setNoteSaved(true); }} onClose={() => setNoteOpen(false)} />
      )}
    </div>
  );
}
