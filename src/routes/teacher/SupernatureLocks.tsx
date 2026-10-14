import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { CREATURES, LOCKS_OWNER, art, defaultLock, type Lock } from '../../lib/supernatureCreatures';

// Supernature creature approvals (Build Queue 107, plan section 9, her rule: "prioritize culturally responsive teaching
// practices and add parameters and locks around culturally appropriative game play"). Every creature, grouped by the
// Globe region it comes from, with three settings: Hidden (students never see it), Explore only (read and learn about
// it, but no Habitat and no remix) and Remix ok. Until she changes one, each keeps its built-in setting.
const REGION_LABEL: Record<string, string> = {
  europe: 'Europe', asia: 'Asia', africa: 'Africa', northamerica: 'North America', southamerica: 'South America', oceania: 'Oceania',
  antarctica: 'Antarctica', atlantic: 'Atlantic Ocean', pacific: 'Pacific Ocean', indian: 'Indian Ocean', arctic: 'Arctic Ocean', southern: 'Southern Ocean',
};
const OPTIONS: { id: Lock; label: string; does: string }[] = [
  { id: 'hidden', label: '🚫 Hidden', does: 'Students never see it.' },
  { id: 'explore', label: '📖 Explore only', does: 'Read and learn about it. No Habitat, no remix.' },
  { id: 'remix', label: '🧬 Remix ok', does: 'Habitat, Creature Maker remix and battles.' },
];

export default function SupernatureLocks() {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === LOCKS_OWNER));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const locks = (row?.look ?? {}) as Record<string, Lock>;
  const regions = [...new Set(CREATURES.map((c) => c.region))];
  const set = (id: string, v: Lock) => mergeStyleRow(LOCKS_OWNER, { [id]: v });
  const setRegion = (region: string, v: Lock) => mergeStyleRow(LOCKS_OWNER, Object.fromEntries(CREATURES.filter((c) => c.region === region).map((c) => [c.id, v])));
  const counts = (l: Lock) => CREATURES.filter((c) => (locks[c.id] ?? defaultLock(c)) === l).length;
  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <div className="content-well stack" style={{ gap: 6 }}>
          <h1 style={{ margin: 0 }}>🔮 Supernature creature approvals</h1>
          <p style={{ margin: 0 }}>Choose how students can use each creature. Changes reach students right away.</p>
          <div className="row-wrap" style={{ gap: 8 }}>
            {OPTIONS.map((o) => <span key={o.id} className="tag-pill"><b>{o.label}</b>&nbsp;{o.does} ({counts(o.id)})</span>)}
          </div>
        </div>
        {regions.map((region) => (
          <div key={region} className="content-well stack" style={{ gap: 8 }}>
            <div className="row-wrap" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <h2 style={{ margin: 0 }}>{REGION_LABEL[region] ?? region}</h2>
              <div className="row-wrap" style={{ gap: 6 }}>
                <small style={{ fontWeight: 700 }}>Set all:</small>
                {OPTIONS.map((o) => <button key={o.id} type="button" className="btn btn-sm" style={{ minHeight: 40 }} onClick={() => setRegion(region, o.id)}>{o.label}</button>)}
              </div>
            </div>
            {CREATURES.filter((c) => c.region === region).map((c) => {
              const cur = locks[c.id] ?? defaultLock(c);
              return (
                <div key={c.id} className="row-wrap" style={{ alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 12, background: cur === 'hidden' ? '#f3f0f7' : '#fff', border: '2px solid var(--content-border)' }}>
                  <img src={art(c.id)} alt="" style={{ width: 48, height: 48, objectFit: 'contain', imageRendering: 'pixelated', opacity: cur === 'hidden' ? 0.4 : 1 }} />
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <b>{c.name}</b> <small style={{ opacity: 0.75 }}>· {c.from}</small>
                    {c.respect && <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{c.respect}</div>}
                    {!locks[c.id] && <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Built-in setting</div>}
                  </div>
                  <div className="row" style={{ gap: 4 }} role="radiogroup" aria-label={`${c.name} setting`}>
                    {OPTIONS.map((o) => (
                      <button key={o.id} type="button" role="radio" aria-checked={cur === o.id} className={`btn btn-sm ${cur === o.id ? 'btn-primary' : ''}`} style={{ minHeight: 44 }} onClick={() => set(c.id, o.id)}>{o.label}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
