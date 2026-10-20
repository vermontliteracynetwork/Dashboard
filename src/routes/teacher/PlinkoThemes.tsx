import { useState } from 'react';
import TeacherNav from '../../components/TeacherNav';
import { makeId } from '../../lib/id';
import { PLINKO_FONTS, buildTheme, cutThemePdf, fontCss, themeVars, usePlinkoThemes, type PlinkoPower, type PlinkoTheme } from '../../lib/plinkoThemes';

// Plinko themes for the teacher (Build Queue 246 and 258): download the Canva template, upload the finished
// PDF, check the preview, then approve it so students can pick it on Plinko's first setup page.
const POWER_LABEL: Record<PlinkoPower, string> = { magnet: 'Magnet (pulls to the biggest bucket)', double: 'Double (counts twice)', big: 'Big Ball (bounces less)', again: 'Second Drop (one more ball)' };

function Preview({ t }: { t: PlinkoTheme }) {
  const v = themeVars(t);
  return (
    <div className="pkt-preview" style={{ ...v, background: v['--pk-bg'] ?? 'radial-gradient(circle at 50% 35%, #ffd34d, #f39a12)' }}>
      <div className="pkt-side" style={{ background: v['--pk-panel'] ?? '#fff4cf', borderColor: t.colors.primary ?? '#f3a417', color: t.colors.text ?? '#241c3d' }}>Scores</div>
      <div className="pkt-board" style={{ background: t.colors.boardBg ?? '#2f8cf0', borderColor: t.colors.boardBorder ?? '#1f5fb8' }}>
        {t.title ? <img src={t.title} alt={t.name} className="pkt-title" /> : <b className="pkt-title-text">{t.name}</b>}
        <div className="pkt-pegs">{Array.from({ length: 15 }, (_, i) => <i key={i} style={{ background: t.colors.peg ?? '#13336b' }} />)}</div>
        <div className="pkt-buckets">{t.buckets.slice(0, 5).map((c, i) => <span key={i} style={{ background: c ?? ['#22c55e', '#f97316', '#ec4899', '#06b6d4', '#8b5cf6'][i] }} />)}</div>
      </div>
      <div className="pkt-side" style={{ background: t.colors.powerBg ?? '#fff', borderColor: t.colors.primary ?? '#f3a417', color: t.colors.text ?? '#241c3d' }}>
        {(['magnet', 'double', 'big', 'again'] as PlinkoPower[]).map((k) => <small key={k}>{t.powers[k]?.img ? <img src={t.powers[k]!.img} alt="" /> : null}{t.powers[k]?.name ?? { magnet: 'Magnet', double: 'Double', big: 'Big Ball', again: 'Second Drop' }[k]}</small>)}
      </div>
    </div>
  );
}

export default function PlinkoThemes() {
  const { themes, save } = usePlinkoThemes();
  const [name, setName] = useState('');
  const [madeBy, setMadeBy] = useState('');
  const [font, setFont] = useState('default');
  const [powerNames, setPowerNames] = useState<Partial<Record<PlinkoPower, string>>>({});
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    if (!file) return;
    setError(null);
    try {
      const cut = await cutThemePdf(file, setStep);
      if (cut.balls.length < 5) throw new Error(`Only ${cut.balls.length} ball${cut.balls.length === 1 ? ' was' : 's were'} designed on page 2. A theme needs at least 5 so every player gets one.`);
      const t = await buildTheme(cut, { id: makeId(), name, madeBy, font, powerNames }, setStep);
      save([t, ...themes]);
      setName(''); setMadeBy(''); setFile(null); setPowerNames({});
      setStep(null);
    } catch (e) {
      setStep(null); setError(e instanceof Error ? e.message : 'The PDF could not be read. Download it from Canva as a PDF and try again.');
    }
  };
  const patch = (id: string, p: Partial<PlinkoTheme>) => save(themes.map((t) => (t.id === id ? { ...t, ...p } : t)));

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <div className="content-well stack" style={{ gap: 8 }}>
          <h1 style={{ margin: 0 }}>🎯 Plinko themes</h1>
          <p style={{ margin: 0 }}>1. Download the template and open it in Canva. 2. Design only the white spaces (you or a student). 3. Download it from Canva as a PDF and upload it here. 4. Check the preview and approve it. Students only see approved themes.</p>
          <a className="btn" href="/plinko/plinko-theme-template.pdf" download style={{ alignSelf: 'flex-start' }}>⬇️ Download the Canva template (6 pages)</a>
        </div>

        <div className="content-well stack" style={{ gap: 10 }}>
          <h2 style={{ margin: 0 }}>Upload a theme</h2>
          <div className="pkt-form">
            <label>Theme name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Winter, Dogs..." /></label>
            <label>Made by (optional)<input value={madeBy} onChange={(e) => setMadeBy(e.target.value)} placeholder="A student's name" /></label>
            <label>Font<select value={font} onChange={(e) => setFont(e.target.value)}>{PLINKO_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
            <span className="pkt-font-sample" style={{ fontFamily: fontCss(font) }}>Ava's turn! 40 XP</span>
          </div>
          <details>
            <summary>Rename the power-ups for this theme (optional)</summary>
            <p className="muted" style={{ margin: '6px 0' }}>They keep the same action. Example: Magnet becomes Super Smell in a dog theme. Their pictures come from page 6.</p>
            <div className="pkt-form">
              {(['magnet', 'double', 'big', 'again'] as PlinkoPower[]).map((k) => (
                <label key={k}>{POWER_LABEL[k]}<input value={powerNames[k] ?? ''} onChange={(e) => setPowerNames({ ...powerNames, [k]: e.target.value })} placeholder="Keep the usual name" /></label>
              ))}
            </div>
          </details>
          <label className="pkt-file">Canva PDF<input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <button type="button" className="btn btn-primary" disabled={!file || !name.trim() || !!step} onClick={upload} style={{ alignSelf: 'flex-start', minHeight: 44 }}>{step ?? 'Upload theme'}</button>
          {!name.trim() && file && <p className="muted" style={{ margin: 0 }}>Give the theme a name first.</p>}
          {error && <p role="alert" style={{ margin: 0, color: '#b42318', fontWeight: 700 }}>{error}</p>}
        </div>

        {themes.length === 0 && <div className="content-well"><p style={{ margin: 0 }}>No themes yet. Students play the default look until you approve one.</p></div>}
        {themes.map((t) => (
          <div key={t.id} className="content-well stack" style={{ gap: 8 }}>
            <div className="row-wrap" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0 }}>{t.name}{t.madeBy ? <small className="muted"> by {t.madeBy}</small> : null}</h2>
              <span className="tag-pill" style={{ background: t.approved ? '#dcfce7' : '#fef3c7' }}>{t.approved ? '✅ Students can pick it' : '⏳ Waiting for your approval'}</span>
            </div>
            <Preview t={t} />
            <div className="pkt-balls">{t.balls.map((b, i) => <img key={i} src={b} alt={`Ball ${i + 1}`} />)}</div>
            <div className="row-wrap" style={{ gap: 8 }}>
              <button type="button" className={`btn ${t.approved ? '' : 'btn-primary'}`} onClick={() => patch(t.id, { approved: !t.approved })}>{t.approved ? 'Hide from students' : '✅ Approve for students'}</button>
              <label className="row-wrap" style={{ gap: 6, alignItems: 'center' }}>Font
                <select value={t.font} onChange={(e) => patch(t.id, { font: e.target.value })}>{PLINKO_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
              </label>
              <button type="button" className="btn btn-danger" onClick={() => { if (window.confirm(`Delete the ${t.name} theme?`)) save(themes.filter((x) => x.id !== t.id)); }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
