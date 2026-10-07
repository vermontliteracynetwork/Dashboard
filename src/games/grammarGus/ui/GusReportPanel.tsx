import { useState } from 'react';
import { useStore } from '../../../store/store';
import { attemptsCsv, summarize, type Attempt, type BlueprintDone } from '../engine/report';
import { useGusSettings, levelFor } from '../settings';

// Teacher report for Grammar Gus's Contraption (plan 3.18.8, 25.10). One
// card per student, read from that student's own Gus row. Teacher only;
// never ranks students against each other.
const LEVEL_NAMES = { full: 'Full help', guided: 'Guided', challenge: 'Challenge' } as const;
const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`);

export default function GusReportPanel() {
  const students = useStore((s) => s.students);
  const rows = useStore((s) => s.styleLooks);
  const settings = useGusSettings();
  const [open, setOpen] = useState<string | null>(null);
  const download = (name: string, attempts: Attempt[]) => {
    const blob = new Blob([attemptsCsv(attempts)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `grammar-gus-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="chrome-frame stack" style={{ padding: 16, gap: 12 }}>
      <h2 style={{ margin: 0 }}>📈 Grammar Gus report</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>Every time a student pulls START, the machine notes how it went. Fixes are the grammar rules the machine or Gus's star review flagged.</p>
      {students.length === 0 && <p style={{ margin: 0, opacity: 0.7 }}>No students yet.</p>}
      {students.map((st) => {
        const look = (rows.find((r) => r.ownerId === `gus:${st.id}`)?.look ?? {}) as { attempts?: Attempt[]; blueprints?: BlueprintDone[] };
        const attempts = look.attempts ?? [];
        const r = summarize(attempts, look.blueprints ?? []);
        const maxStars = Math.max(1, ...r.stars);
        const isOpen = open === st.id;
        return (
          <div key={st.id} className="stack" style={{ gap: 8, padding: 12, borderRadius: 12, border: '1px solid rgba(0,0,0,0.15)' }}>
            <div className="row-wrap" style={{ gap: 10, alignItems: 'center' }}>
              <strong style={{ fontSize: '1.05rem' }}>{st.name}</strong>
              <span style={{ opacity: 0.75 }}>{LEVEL_NAMES[levelFor(settings, st.id)]}</span>
              <span style={{ opacity: 0.75 }}>{r.lastAt ? `Last played ${new Date(r.lastAt).toLocaleDateString()}` : 'Not played yet'}</span>
              <span style={{ flex: 1 }} />
              {attempts.length > 0 && <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => download(st.name, attempts)}>⬇ CSV</button>}
              {attempts.length > 0 && <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setOpen(isOpen ? null : st.id)} aria-expanded={isOpen}>{isOpen ? 'Less' : 'More'}</button>}
            </div>
            {attempts.length > 0 && (
              <div className="row-wrap" style={{ gap: 18, alignItems: 'flex-end' }}>
                <div className="stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>This week ({r.week} tries)</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 56 }} role="img" aria-label={`This week: ${r.stars[0]} did not run, ${r.stars[1]} one star, ${r.stars[2]} two stars, ${r.stars[3]} three stars`}>
                    {(['Leak', '1★', '2★', '3★'] as const).map((label, i) => (
                      <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: '0.72rem' }}>
                        <span>{r.stars[i]}</span>
                        <span style={{ width: 26, height: Math.max(3, (r.stars[i] / maxStars) * 34), borderRadius: 4, background: ['#b8c2cc', '#f0b37e', '#f2d06b', '#5bb04a'][i] }} />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Stat label="3 stars this week" value={pct(r.threeStarRate)} />
                <Stat label="Tries per 3-star sentence" value={r.triesToThree === null ? '–' : String(r.triesToThree)} />
                <Stat label="Words per 3-star sentence" value={r.avgWords === null ? '–' : String(r.avgWords)} />
                <Stat label="Pulls right after the Hopper" value={pct(r.hopperRate)} />
                <Stat label="Blueprints finished" value={String(r.blueprints)} />
              </div>
            )}
            {r.topCodes.length > 0 && (
              <div style={{ fontSize: '0.9rem' }}><strong>Most common fixes (30 days):</strong> {r.topCodes.map((c) => `${c.name} (${c.count})`).join(', ')}</div>
            )}
            {isOpen && (
              <div className="stack" style={{ gap: 6, fontSize: '0.9rem' }}>
                <div><strong>Times used (3-star, 30 days):</strong> Past {r.tenses.past}, Present {r.tenses.present}, Future {r.tenses.future}</div>
                <div><strong>By help level (30 days):</strong> {Object.entries(r.levels).map(([l, v]) => `${LEVEL_NAMES[l as keyof typeof LEVEL_NAMES]}: ${v!.three} of ${v!.tries} at 3 stars`).join('; ') || '–'}</div>
                <div><strong>Sentence length by week:</strong> {r.lengthTrend.map((w) => `${w.week}: ${w.avg} words (${w.count})`).join('; ') || '–'}</div>
                {r.recent.length > 0 && <div><strong>Recent 3-star sentences:</strong><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{r.recent.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stack" style={{ gap: 2, minWidth: 110 }}>
      <span style={{ fontSize: '1.3rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: '0.78rem', opacity: 0.75 }}>{label}</span>
    </div>
  );
}
