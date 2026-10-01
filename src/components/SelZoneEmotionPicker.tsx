import { useState } from 'react';
import { SEL_ZONES, SEL_ZONE_LABELS, SEL_ZONE_COLORS, SEL_ZONE_FACE, SEL_ZONE_EMOTIONS, SEL_EMOTION_FACE } from '../lib/selZones';
import type { SelZone } from '../types';

// Shared two-step zone -> emotion picker (docs/ZONES_OF_REGULATION_CHECKIN.md
// §1, §3 — "same 4-zone then emotion-grid components" for both the login
// check-in and every later Neighbor re-check, not a separate screen). Every
// button stays re-tappable with no timer/auto-advance; "Back" from the
// emotion grid returns to the zone grid without losing anything, matching
// the spec's "easy to change your tap."
// hideQuestion: the caller already shows the "How are you feeling" line
// itself (the Neighbor re-check's center message), so don't repeat it.
export default function SelZoneEmotionPicker({ onPick, hideQuestion }: { onPick: (zone: SelZone, emotion: string) => void; hideQuestion?: boolean }) {
  const [zone, setZone] = useState<SelZone | null>(null);

  if (!zone) {
    return (
      <div className="stack sel-picker" style={{ alignItems: 'center', textAlign: 'center', gap: 14 }}>
        {!hideQuestion && (
          <>
            <p className="sel-picker-question">How are you feeling right now?</p>
            <p className="sel-picker-subtext">All four zones are okay to feel. Pick the one that's true right now.</p>
          </>
        )}
        <div className="row-wrap" style={{ justifyContent: 'center', gap: 14 }}>
          {SEL_ZONES.map((z) => (
            <button
              key={z}
              className="sel-zone-btn"
              style={{ borderColor: SEL_ZONE_COLORS[z] }}
              onClick={() => setZone(z)}
              aria-label={`${SEL_ZONE_LABELS[z]} Zone`}
            >
              <span className="sel-zone-face" aria-hidden="true">{SEL_ZONE_FACE[z]}</span>
              <span className="sel-zone-label">{SEL_ZONE_LABELS[z]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stack sel-picker" style={{ alignItems: 'center', textAlign: 'center', gap: 14 }}>
      <p className="sel-picker-question">Pick what {SEL_ZONE_LABELS[zone]} feels like for you.</p>
      <div className="row-wrap" style={{ justifyContent: 'center', gap: 12 }}>
        {SEL_ZONE_EMOTIONS[zone].map((emotion) => (
          <button
            key={emotion}
            className="sel-emotion-btn"
            style={{ borderColor: SEL_ZONE_COLORS[zone] }}
            onClick={() => onPick(zone, emotion)}
          >
            <span className="sel-emotion-face" aria-hidden="true">{SEL_EMOTION_FACE[emotion] ?? SEL_ZONE_FACE[zone]}</span>
            <span className="sel-emotion-label">{emotion}</span>
          </button>
        ))}
      </div>
      <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setZone(null)}>← Back</button>
    </div>
  );
}
