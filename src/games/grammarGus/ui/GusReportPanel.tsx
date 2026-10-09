import { useState } from 'react';
import { useStore } from '../../../store/store';
import { attemptsCsv, summarize, type Attempt, type BlueprintDone, type Report } from '../engine/report';
import { useGusSettings, levelFor } from '../settings';
import type { CheckupResult } from './Checkup';

// Teacher report for Grammar Gus's Contraption (plan 3.18.8, 25.10). One
// card per student, read from that student's own Gus row. Teacher only;
// never ranks students against each other.
const LEVEL_NAMES = { full: 'Full help', guided: 'Guided', challenge: 'Challenge' } as const;
const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`);

// Teacher notes and IEP goal lines (Build Queue 2026-10-09: "Teacher report: PDF export, IEP goal
// lines on a progress graph, teacher notes"). Saved as the `gusnote:<studentId>` style_looks row.
interface GusNote { notes?: string; goalWords?: number; goalRate?: number }
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
// The progress graph: words per 3-star sentence by week, with the IEP goal as a dashed line.
function trendSvg(r: Report, goal?: number): string {
  const pts = r.lengthTrend;
  if (!pts.length) return '<p>No 3-star sentences yet.</p>';
  const W = 520, H = 200, L = 40, B = 30, T = 14, R = 14;
  const max = Math.max(goal ?? 0, ...pts.map((p) => p.avg), 4) + 1;
  const x = (i: number) => L + (pts.length === 1 ? (W - L - R) / 2 : (i / (pts.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, Math.round(max / 2), Math.floor(max)];
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Words per 3-star sentence by week">
    ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="#e3e6ec"/><text x="${L - 6}" y="${y(t) + 4}" font-size="11" text-anchor="end" fill="#555">${t}</text>`).join('')}
    ${goal ? `<line x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}" stroke="#c0392b" stroke-dasharray="6 4" stroke-width="2"/><text x="${W - R}" y="${y(goal) - 5}" font-size="11" text-anchor="end" fill="#c0392b">IEP goal: ${goal} words</text>` : ''}
    <polyline fill="none" stroke="#2f6fd0" stroke-width="2.5" points="${pts.map((p, i) => `${x(i)},${y(p.avg)}`).join(' ')}"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.avg)}" r="4" fill="#2f6fd0"/><text x="${x(i)}" y="${H - 10}" font-size="10" text-anchor="middle" fill="#555">${esc(p.week)}</text>`).join('')}
  </svg>`;
}
function printReport(name: string, level: string, r: Report, note: GusNote, checks: CheckupResult[] = []) {
  const w = window.open('', '_blank');
  if (!w) return;
  const rate = r.threeStarRate === null ? null : Math.round(r.threeStarRate * 100);
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Grammar Gus report: ${esc(name)}</title>
  <style>body{font-family:system-ui,sans-serif;color:#1c2b44;max-width:760px;margin:24px auto;padding:0 16px}h1{margin:0 0 4px}h2{margin:22px 0 6px;font-size:1.1rem;border-bottom:2px solid #e3e6ec;padding-bottom:4px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.stat{border:1px solid #d8dde6;border-radius:10px;padding:8px}.stat b{display:block;font-size:1.4rem}.stat span{font-size:.8rem;color:#555}
  .goal{color:#c0392b;font-weight:700}.met{color:#2e7d5b;font-weight:700}p,li{line-height:1.45}.notes{white-space:pre-wrap;border:1px solid #d8dde6;border-radius:10px;padding:10px}@media print{button{display:none}}</style></head><body>
  <button onclick="window.print()" style="min-height:44px;padding:0 16px;margin-bottom:12px">Save as PDF or print</button>
  <h1>Grammar Gus report: ${esc(name)}</h1><div>${esc(level)} · ${new Date().toLocaleDateString()} · ${r.total} tries in all${r.lastAt ? `, last played ${new Date(r.lastAt).toLocaleDateString()}` : ''}</div>
  <h2>This week</h2><div class="grid">
    <div class="stat"><b>${rate === null ? '–' : `${rate}%`}</b><span>sentences at 3 stars (${r.week} tries)${note.goalRate ? `<br><span class="${rate !== null && rate >= note.goalRate ? 'met' : 'goal'}">IEP goal: ${note.goalRate}%${rate !== null && rate >= note.goalRate ? ' (met)' : ''}</span>` : ''}</span></div>
    <div class="stat"><b>${r.avgWords ?? '–'}</b><span>words per 3-star sentence (30 days)${note.goalWords ? `<br><span class="${(r.avgWords ?? 0) >= note.goalWords ? 'met' : 'goal'}">IEP goal: ${note.goalWords} words${(r.avgWords ?? 0) >= note.goalWords ? ' (met)' : ''}</span>` : ''}</span></div>
    <div class="stat"><b>${r.triesToThree ?? '–'}</b><span>tries per 3-star sentence</span></div>
    <div class="stat"><b>${r.stars[3]} / ${r.stars[2]} / ${r.stars[1]} / ${r.stars[0]}</b><span>3 stars / 2 / 1 / did not run, this week</span></div>
    <div class="stat"><b>${r.blueprints}</b><span>Blueprints finished</span></div>
    <div class="stat"><b>${r.tenses.past} / ${r.tenses.present} / ${r.tenses.future}</b><span>past / present / future (3-star, 30 days)</span></div>
  </div>
  <h2>Progress: sentence length by week</h2>${trendSvg(r, note.goalWords)}
  <h2>Most common fixes (30 days)</h2><p>${r.topCodes.length ? r.topCodes.map((c) => `${esc(c.name)} (${c.count})`).join(', ') : 'None yet.'}</p>
  <h2>By help level (30 days)</h2><p>${Object.entries(r.levels).map(([l, v]) => `${LEVEL_NAMES[l as keyof typeof LEVEL_NAMES]}: ${v!.three} of ${v!.tries} at 3 stars`).join('; ') || 'None yet.'}</p>
  <h2>Recent 3-star sentences</h2>${r.recent.length ? `<ul>${r.recent.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p>None yet.</p>'}
  <h2>Gus's Checkup</h2>${checks.length ? `<p>${checks.map((c) => `${new Date(c.at).toLocaleDateString()}: ${c.right} of ${c.of}`).join(' · ')}</p><ul>${Object.entries(checks[checks.length - 1].skills).map(([s, ok]) => `<li>${ok ? '✅' : '⬜'} ${esc(s)}</li>`).join('')}</ul>` : '<p>Not taken yet. Students find it in Jobs, Mini games.</p>'}
  <h2>Teacher notes</h2><div class="notes">${note.notes ? esc(note.notes) : 'No notes.'}</div>
  </body></html>`);
  w.document.close();
  w.setTimeout(() => w.print(), 400);
}

export default function GusReportPanel() {
  const students = useStore((s) => s.students);
  const rows = useStore((s) => s.styleLooks);
  const settings = useGusSettings();
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [open, setOpen] = useState<string | null>(null);
  const [notesFor, setNotesFor] = useState<string | null>(null);
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
        const look = (rows.find((r) => r.ownerId === `gus:${st.id}`)?.look ?? {}) as { attempts?: Attempt[]; blueprints?: BlueprintDone[]; checkups?: CheckupResult[] };
        const checks = look.checkups ?? [];
        const firstCheck = checks[0], lastCheck = checks[checks.length - 1];
        const attempts = look.attempts ?? [];
        const r = summarize(attempts, look.blueprints ?? []);
        const maxStars = Math.max(1, ...r.stars);
        const isOpen = open === st.id;
        const note = (rows.find((x) => x.ownerId === `gusnote:${st.id}`)?.look ?? {}) as GusNote;
        const setNote = (patch: GusNote) => mergeStyleRow(`gusnote:${st.id}`, patch as Record<string, unknown>);
        return (
          <div key={st.id} className="stack" style={{ gap: 8, padding: 12, borderRadius: 12, border: '1px solid rgba(0,0,0,0.15)' }}>
            <div className="row-wrap" style={{ gap: 10, alignItems: 'center' }}>
              <strong style={{ fontSize: '1.05rem' }}>{st.name}</strong>
              <span style={{ opacity: 0.75 }}>{LEVEL_NAMES[levelFor(settings, st.id)]}</span>
              <span style={{ opacity: 0.75 }}>{r.lastAt ? `Last played ${new Date(r.lastAt).toLocaleDateString()}` : 'Not played yet'}</span>
              <span style={{ flex: 1 }} />
              {attempts.length > 0 && <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => download(st.name, attempts)}>⬇ CSV</button>}
              <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => printReport(st.name, LEVEL_NAMES[levelFor(settings, st.id)], r, note, checks)}>📄 PDF</button>
              <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setNotesFor(notesFor === st.id ? null : st.id)} aria-expanded={notesFor === st.id}>📝 Notes and goals</button>
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
            {notesFor === st.id && (
              <div className="stack" style={{ gap: 8, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.04)' }}>
                <div className="row-wrap" style={{ gap: 14 }}>
                  <label className="row" style={{ gap: 6 }}>IEP goal: words per sentence
                    <input type="number" min={2} max={20} style={{ width: 70, minHeight: 36 }} value={note.goalWords ?? ''} onChange={(e) => setNote({ goalWords: e.target.value ? Number(e.target.value) : undefined })} /></label>
                  <label className="row" style={{ gap: 6 }}>IEP goal: % at 3 stars
                    <input type="number" min={10} max={100} step={5} style={{ width: 70, minHeight: 36 }} value={note.goalRate ?? ''} onChange={(e) => setNote({ goalRate: e.target.value ? Number(e.target.value) : undefined })} /></label>
                </div>
                <label className="stack" style={{ gap: 4 }}>Teacher notes (they print on the PDF)
                  <textarea rows={3} defaultValue={note.notes ?? ''} onBlur={(e) => setNote({ notes: e.target.value })} style={{ width: '100%' }} /></label>
                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>The goals show as a dashed line on the PDF's progress graph, and say "met" when the student reaches them.</span>
              </div>
            )}
            {(note.goalWords || note.goalRate) && attempts.length > 0 && (
              <div style={{ fontSize: '0.9rem' }}><strong>IEP goals:</strong> {note.goalWords ? `${note.goalWords} words per sentence (now ${r.avgWords ?? '–'})` : ''}{note.goalWords && note.goalRate ? '; ' : ''}{note.goalRate ? `${note.goalRate}% at 3 stars (now ${pct(r.threeStarRate)})` : ''}</div>
            )}
            {lastCheck && (
              <div style={{ fontSize: '0.9rem' }}>
                <strong>🩺 Gus's Checkup:</strong> {lastCheck.right} of {lastCheck.of} on {new Date(lastCheck.at).toLocaleDateString()}{checks.length > 1 ? ` (first: ${firstCheck.right} of ${firstCheck.of} on ${new Date(firstCheck.at).toLocaleDateString()})` : ''}.
                {' '}Still learning: {Object.entries(lastCheck.skills).filter(([, ok]) => !ok).map(([s]) => s).join(', ') || 'nothing, all right!'}
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
