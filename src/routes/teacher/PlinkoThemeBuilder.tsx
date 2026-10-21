import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import TeacherNav from '../../components/TeacherNav';
import GameTabs from './GameTabs';
import { makeId } from '../../lib/id';
import { uploadImage } from '../../lib/upload';
import { BALLS } from '../student/PlinkoSetup';
import {
  DEFAULT_POWERS, PLINKO_FONTS, POWER_KINDS, buildTheme, cutThemePdf, fontFamilyFor, themeVars, usePlinkoThemes,
  type FontChoice, type PlinkoColorKey, type PlinkoPower, type PlinkoTheme, type PowerDef, type PowerKind,
} from '../../lib/plinkoThemes';

// The Plinko theme builder (Build Queue 296, her request: a Themes sub-tab in the teacher Game section, then a page
// for Plinko with a live preview of the game view on top, a row of upload cards that each show a check once filled,
// a color palette with hex codes, fonts for the title, headers and body (a preset or an uploaded font file), a 1x1
// cover, the four power-ups redesigned plus added ones with their logic, and Save). Anything left empty keeps the
// default Plinko look. Teacher-facing only, so plain and professional.

const UI = '/games/plinko/ui/';
const DEFAULT_ICON: Record<string, string | null> = { double: `${UI}power-double.png`, big: `${UI}power-big.png`, magnet: null, again: `${UI}power-again.png` };
const DEF = { bg: 'linear-gradient(135deg, #9AEFF6 0%, #E9E4F7 45%, #FDC3EC 100%)', board: '#127FB5', edge: '#6C626E', peg: '#F9FBF4', panel: '#F9FBF4', text: '#6C626E', primary: '#FF8AC4', secondary: '#93BFE6', zone: '#93BFE6', powerBg: '#FFFFFF', powerBtn: '#127FB5' };
const BUCKET_DEF = ['#C3FCB6', '#FFDCD6', '#FDC3EC', '#9AEFF6', '#E3FCC3', '#93BFE6', '#FF8AC4', '#F9FBF4'];
const COLORS: { key: PlinkoColorKey; label: string; hint: string; def: string }[] = [
  { key: 'primary', label: 'Primary', hint: 'Primary buttons, turn highlight, panel edges', def: DEF.primary },
  { key: 'secondary', label: 'Secondary', hint: 'Secondary buttons', def: DEF.secondary },
  { key: 'text', label: 'Text', hint: 'All game text', def: DEF.text },
  { key: 'panelBg', label: 'Side panels', hint: 'Used when there is no side panel picture', def: DEF.panel },
  { key: 'boardBg', label: 'Board', hint: 'Used when there is no board picture', def: DEF.board },
  { key: 'boardBorder', label: 'Board border', hint: 'Edge around the board', def: DEF.edge },
  { key: 'peg', label: 'Pegs', hint: 'The pegs the ball bounces off', def: DEF.peg },
  { key: 'zone', label: 'Drop zones', hint: 'The numbered tiles across the top', def: DEF.zone },
  { key: 'powerBg', label: 'Power-up cards', hint: 'Behind each power-up', def: DEF.powerBg },
  { key: 'powerBtn', label: 'Power-up buttons', hint: 'The Select buttons', def: DEF.powerBtn },
];
const FONT_ROLES: { key: 'title' | 'header' | 'body'; label: string; sample: string }[] = [
  { key: 'title', label: 'Title', sample: 'Plinko' },
  { key: 'header', label: 'Headers', sample: 'Scores and Power-ups' },
  { key: 'body', label: 'Body text', sample: "Ava's turn. Round 2 of 5." },
];
const blank = (): PlinkoTheme => ({ id: makeId(), name: '', font: 'default', approved: false, createdAt: new Date().toISOString(), balls: [], colors: {}, buckets: [], powers: {}, customPowers: [], fonts: {} });
const HEX = /^#[0-9a-f]{6}$/i;
const Check = () => <svg viewBox="0 0 20 20" width="20" height="20" aria-label="Done"><circle cx="10" cy="10" r="10" fill="#16a34a" /><path d="M5.5 10.5l3 3 6-7" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Magnet = ({ size = 30 }: { size?: number }) => <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden><path d="M8 5v11a8 8 0 0 0 16 0V5h-6v11a2 2 0 0 1-4 0V5z" fill="#127FB5" stroke="#6C626E" strokeWidth="1.2" /></svg>;
const kindText = (p: PowerDef) => { const k = POWER_KINDS.find((x) => x.kind === p.kind); return k ? `${k.label}${k.nLabel ? ` (${k.nLabel.toLowerCase()} ${p.n ?? k.nDef})` : ''}` : ''; };

function useUpload() {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const up = async (key: string, file: File | undefined | null, done: (url: string) => void) => {
    if (!file) return;
    setBusy(key); setErr(null);
    try { done(await uploadImage(file)); } catch (e) { setErr(e instanceof Error ? e.message : 'The file could not be uploaded.'); }
    setBusy(null);
  };
  return { busy, err, up };
}

function Preview({ t }: { t: PlinkoTheme }) {
  const v = themeVars(t) as Record<string, string>;
  const c = (k: PlinkoColorKey, d: string) => t.colors[k] ?? d;
  const body = v.fontFamily;
  const head = v['--pk-head-font'] ?? body, title = v['--pk-title-font'] ?? body;
  const ball = (i: number) => (t.balls[i] ? `center / contain no-repeat url("${t.balls[i]}")` : BALLS[i].bg);
  const powers = [...DEFAULT_POWERS.map((d) => ({ ...d, ...{ name: t.powers[d.id as PlinkoPower]?.name || d.name, img: t.powers[d.id as PlinkoPower]?.img } })), ...(t.customPowers ?? [])];
  const panel = (extra?: string) => ({ background: t.panel ? `center / cover url("${t.panel}")` : c('panelBg', DEF.panel), borderColor: c('primary', DEF.primary), color: c('text', DEF.text), ...(extra ? { background: extra } : {}) });
  return (
    <div className="ptb-preview" style={{ background: t.background ? `center / cover no-repeat url("${t.background}")` : DEF.bg, fontFamily: body, color: c('text', DEF.text) }} aria-label="Theme preview">
      <div className="ptb-head">
        {t.title ? <img src={t.title} alt={t.name || 'Title'} /> : <b style={{ fontFamily: title }}>Plinko</b>}
        <span className="ptb-chip" style={{ background: c('secondary', DEF.secondary) }}>My best</span>
        <span className="ptb-chip" style={{ background: c('secondary', DEF.secondary) }}>120 XP</span>
      </div>
      <div className="ptb-main">
        <aside className="ptb-panel" style={panel()}>
          <h4 style={{ fontFamily: head }}>Scores</h4>
          {['Ava', 'Roscoe'].map((n, i) => (
            <div key={n} className={`ptb-player${i === 0 ? ' on' : ''}`} style={{ boxShadow: i === 0 ? `0 0 0 2px ${c('primary', DEF.primary)}` : undefined }}>
              <i style={{ background: ball(i) }} /><span>{n}</span><b>{i === 0 ? 40 : 20}</b>
            </div>
          ))}
          <small>Round 2 of 5</small>
        </aside>
        <section className="ptb-board" style={{ background: t.board ? `center / cover url("${t.board}")` : c('boardBg', DEF.board), borderColor: c('boardBorder', DEF.edge) }}>
          <span className="ptb-turn" style={{ background: c('primary', DEF.primary) }}>Ava's turn</span>
          <div className="ptb-zones">{[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ background: c('zone', DEF.zone), borderColor: c('boardBorder', DEF.edge), color: c('text', DEF.text) }}>{n}</span>)}</div>
          <div className="ptb-pegs">{Array.from({ length: 23 }, (_, i) => <i key={i} style={{ background: c('peg', DEF.peg) }} />)}<b className="ptb-ball" style={{ background: ball(0) }} /></div>
          <div className="ptb-buckets">{[10, 30, 20, 40, 10].map((n, i) => (
            <span key={i} style={{ background: t.buckets[i] ?? BUCKET_DEF[i], borderColor: c('boardBorder', DEF.edge), color: c('text', DEF.text) }}>{i === 1 && <img src={`${UI}star_full.png`} alt="" />}{n}</span>
          ))}</div>
        </section>
        <aside className="ptb-panel" style={panel()}>
          <h4 style={{ fontFamily: head }}>Power-ups</h4>
          {powers.slice(0, 5).map((p) => (
            <div key={p.id} className="ptb-power" style={{ background: c('powerBg', DEF.powerBg), borderColor: c('boardBorder', DEF.edge) }}>
              {p.img ? <img src={p.img} alt="" /> : DEFAULT_ICON[p.id] ? <img src={DEFAULT_ICON[p.id]!} alt="" /> : p.id === 'magnet' ? <Magnet size={22} /> : <span className="ptb-noimg" />}
              <span>{p.name || 'New power-up'}</span>
              <em style={{ background: c('powerBtn', DEF.powerBtn) }}>Select</em>
            </div>
          ))}
          {powers.length > 5 && <small>and {powers.length - 5} more</small>}
        </aside>
      </div>
    </div>
  );
}

function ImageCard({ label, hint, required, value, busy, onFile, onClear, multiple, count, children }: {
  label: string; hint: string; required?: boolean; value?: string; busy: boolean; onFile: (f: FileList) => void; onClear?: () => void; multiple?: boolean; count?: string; children?: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = !!value || (count !== undefined && !required) || (!!count && !count.startsWith('0'));
  return (
    <div className={`ptb-card${value ? ' filled' : ''}`}>
      <div className="ptb-card-top">
        <b>{label}</b>
        {required && <span className="ptb-req">Required</span>}
        {(value || (multiple && count && Number(count.split(' ')[0]) >= 5)) && <span className="ptb-check"><Check /></span>}
      </div>
      <div className="ptb-thumb">{children ?? (value ? <img src={value} alt="" /> : <span>Default</span>)}</div>
      <p className="ptb-hint">{hint}{count ? ` ${count}` : ''}</p>
      <div className="ptb-card-actions">
        <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Uploading...' : value || (multiple && done && count && !count.startsWith('0')) ? (multiple ? 'Add more' : 'Replace') : 'Upload'}</button>
        {(value || (multiple && count && !count.startsWith('0'))) && onClear && <button type="button" className="btn btn-sm" onClick={onClear}>Remove{multiple ? ' all' : ''}</button>}
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple={multiple} hidden onChange={(e) => { if (e.target.files?.length) onFile(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

function ColorField({ label, hint, value, def, onChange }: { label: string; hint: string; value?: string; def: string; onChange: (v?: string) => void }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  return (
    <div className="ptb-color">
      <input type="color" value={value ?? def} onChange={(e) => onChange(e.target.value)} aria-label={`${label} color`} />
      <div>
        <b>{label}</b><small>{hint}</small>
        <div className="ptb-hex">
          <input value={text} placeholder={def} maxLength={7} aria-label={`${label} hex code`} onChange={(e) => { const x = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`; setText(e.target.value); if (HEX.test(x)) onChange(x.toLowerCase()); }} />
          {value && <button type="button" className="ptb-link" onClick={() => onChange(undefined)}>Default</button>}
        </div>
      </div>
    </div>
  );
}

export default function PlinkoThemeBuilder() {
  const { themes, save } = usePlinkoThemes();
  const [draft, setDraft] = useState<PlinkoTheme>(blank);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [pdfStep, setPdfStep] = useState<string | null>(null);
  const { busy, err, up } = useUpload();
  const set = (p: Partial<PlinkoTheme>) => { setDraft((d) => ({ ...d, ...p })); setDirty(true); setSaved(null); };
  const open = (t?: PlinkoTheme) => {
    if (dirty && !window.confirm('You have changes that are not saved. Leave them?')) return;
    setDraft(t ? { customPowers: [], fonts: {}, ...structuredClone(t) } : blank()); setDirty(false); setSaved(null);
  };
  const missing = [!draft.name.trim() && 'a theme name', !draft.cover && 'a 1x1 cover', draft.balls.length < 5 && `at least 5 balls (${draft.balls.length} now)`].filter(Boolean) as string[];
  const unbuilt = (draft.customPowers ?? []).filter((p) => p.kind === 'none');
  const doSave = (approved = draft.approved) => {
    if (!draft.name.trim()) { setSaved('Give the theme a name first.'); return; }
    const t = { ...draft, approved: approved && missing.length === 0 };
    save(themes.some((x) => x.id === t.id) ? themes.map((x) => (x.id === t.id ? t : x)) : [t, ...themes]);
    setDraft(t); setDirty(false); setSaved(t.approved ? 'Saved. Students can pick this theme.' : 'Saved as a draft. Students do not see it yet.');
  };
  const setPower = (id: PlinkoPower, p: Partial<{ name: string; img: string; does: string }>) => set({ powers: { ...draft.powers, [id]: { ...draft.powers[id], ...p } } });
  const setCustom = (i: number, p: Partial<PowerDef>) => set({ customPowers: (draft.customPowers ?? []).map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const importPdf = async (file?: File) => {
    if (!file) return;
    try {
      const cut = await cutThemePdf(file, setPdfStep);
      const t = await buildTheme(cut, { id: draft.id, name: draft.name, font: draft.font, powerNames: {} }, setPdfStep);
      set({ background: t.background ?? draft.background, panel: t.panel ?? draft.panel, title: t.title ?? draft.title, balls: t.balls.length ? t.balls : draft.balls, colors: { ...draft.colors, ...t.colors }, buckets: t.buckets.some(Boolean) ? t.buckets : draft.buckets, powers: { ...draft.powers, ...t.powers } });
      setPdfStep('Imported. Check the preview, then Save.');
    } catch (e) { setPdfStep(e instanceof Error ? e.message : 'The PDF could not be read.'); }
  };
  const fonts = draft.fonts ?? {};
  const setFont = (k: 'title' | 'header' | 'body', f?: FontChoice) => set({ fonts: { ...fonts, [k]: f } });
  const sorted = useMemo(() => themes.slice().sort((a, b) => a.name.localeCompare(b.name)), [themes]);

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack ptb">
        <GameTabs />
        <nav className="ptb-crumbs" aria-label="Breadcrumb"><Link to="/teacher/game/themes">Themes</Link><span>/</span><b>Plinko</b></nav>

        <div className="ptb-themes" aria-label="Saved themes">
          {sorted.map((t) => (
            <button key={t.id} type="button" className={`ptb-theme${t.id === draft.id ? ' on' : ''}`} onClick={() => open(t)}>
              <span style={{ background: t.cover ? `center / cover url("${t.cover}")` : '#eef0f4' }} />
              <b>{t.name}</b><small className={t.approved ? 'live' : ''}>{t.approved ? 'Live' : 'Draft'}</small>
            </button>
          ))}
          <button type="button" className="ptb-theme new" onClick={() => open()}><span>+</span><b>New theme</b></button>
        </div>

        <section className="ptb-bar content-well">
          <label className="ptb-field">Theme name <span className="ptb-req">Required</span>
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Winter, Dogs, Space..." />
          </label>
          <label className="ptb-field">Made by
            <input value={draft.madeBy ?? ''} onChange={(e) => set({ madeBy: e.target.value || undefined })} placeholder="Optional, for example a student's name" />
          </label>
          <div className="ptb-actions">
            <label className="ptb-toggle" title={missing.length ? `Add ${missing.join(', ')} first` : ''}>
              <input type="checkbox" checked={draft.approved} disabled={missing.length > 0} onChange={(e) => set({ approved: e.target.checked })} /> Show to students
            </label>
            <button type="button" className="btn btn-primary" onClick={() => doSave()}>Save</button>
            {themes.some((x) => x.id === draft.id) && <button type="button" className="btn btn-danger" onClick={() => { if (window.confirm(`Delete the ${draft.name} theme?`)) { save(themes.filter((x) => x.id !== draft.id)); setDraft(blank()); setDirty(false); } }}>Delete</button>}
          </div>
          {missing.length > 0 && <p className="ptb-note">Before students can see this theme, add {missing.join(', ')}. You can save a draft at any time.</p>}
          {dirty && <p className="ptb-note warn">Changes not saved yet.</p>}
          {saved && <p className="ptb-note ok" role="status">{saved}</p>}
          {err && <p className="ptb-note bad" role="alert">{err}</p>}
        </section>

        <section className="ptb-section">
          <h2>Preview</h2>
          <Preview t={draft} />
          <p className="ptb-hint">Anything you leave empty keeps the default Plinko look.</p>
        </section>

        <section className="ptb-section">
          <h2>Images</h2>
          <div className="ptb-cards">
            <ImageCard label="Cover" required hint="Square (1:1). Students see it when they pick a theme." value={draft.cover} busy={busy === 'cover'} onFile={(f) => up('cover', f[0], (u) => set({ cover: u }))} onClear={() => set({ cover: undefined })}>
              {draft.cover ? <img src={draft.cover} alt="" className="sq" /> : <span>Empty</span>}
            </ImageCard>
            <ImageCard label="Background" hint="Fills the screen behind the game. Landscape, about 2048 x 1536." value={draft.background} busy={busy === 'background'} onFile={(f) => up('background', f[0], (u) => set({ background: u }))} onClear={() => set({ background: undefined })} />
            <ImageCard label="Title" hint="The game name as a PNG with a see-through background." value={draft.title} busy={busy === 'title'} onFile={(f) => up('title', f[0], (u) => set({ title: u }))} onClear={() => set({ title: undefined })} />
            <ImageCard label="Board" hint="Behind the pegs. Portrait or square." value={draft.board} busy={busy === 'board'} onFile={(f) => up('board', f[0], (u) => set({ board: u }))} onClear={() => set({ board: undefined })} />
            <ImageCard label="Side panels" hint="Behind the scoreboard and power-ups. Keep the middle calm." value={draft.panel} busy={busy === 'panel'} onFile={(f) => up('panel', f[0], (u) => set({ panel: u }))} onClear={() => set({ panel: undefined })} />
            <ImageCard label="Balls" required multiple hint="Square PNGs with see-through corners. At least 5, up to 10." count={`${draft.balls.length} of 10`} busy={busy === 'balls'}
              onFile={async (fl) => { const files = Array.from(fl).slice(0, 10 - draft.balls.length); const urls: string[] = []; for (const f of files) await up('balls', f, (u) => urls.push(u)); if (urls.length) set({ balls: [...draft.balls, ...urls].slice(0, 10) }); }}
              onClear={() => set({ balls: [] })}>
              {draft.balls.length ? <div className="ptb-balls">{draft.balls.map((b, i) => <button key={i} type="button" title="Remove this ball" onClick={() => set({ balls: draft.balls.filter((_, k) => k !== i) })}><img src={b} alt={`Ball ${i + 1}`} /></button>)}</div> : <span>Default balls</span>}
            </ImageCard>
          </div>
        </section>

        <section className="ptb-section">
          <h2>Colors</h2>
          <p className="ptb-hint">Pick a color or type a hex code. Primary sets every primary button and highlight.</p>
          <div className="ptb-colors">
            {COLORS.map((c) => <ColorField key={c.key} label={c.label} hint={c.hint} def={c.def} value={draft.colors[c.key]} onChange={(v) => set({ colors: { ...draft.colors, [c.key]: v } })} />)}
          </div>
          <h3>Buckets</h3>
          <div className="ptb-colors compact">
            {BUCKET_DEF.map((d, i) => <ColorField key={i} label={`Bucket ${i + 1}`} hint={i < 3 ? 'Shown from round 1' : `Shown from round ${i - 1}`} def={d} value={draft.buckets[i] ?? undefined}
              onChange={(v) => { const b = [...draft.buckets]; while (b.length < 8) b.push(null); b[i] = v ?? null; set({ buckets: b }); }} />)}
          </div>
        </section>

        <section className="ptb-section">
          <h2>Fonts</h2>
          <div className="ptb-fonts">
            {FONT_ROLES.map((r) => {
              const f = fonts[r.key];
              return (
                <div key={r.key} className="ptb-font">
                  <b>{r.label}</b>
                  <select value={f?.url ? 'upload' : f?.preset ?? ''} onChange={(e) => setFont(r.key, e.target.value ? { preset: e.target.value } : undefined)} aria-label={`${r.label} font`}>
                    <option value="">Default</option>
                    {PLINKO_FONTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    {f?.url && <option value="upload">Uploaded: {f.name}</option>}
                  </select>
                  <label className="btn btn-sm">{busy === `font-${r.key}` ? 'Uploading...' : 'Upload font file'}
                    <input type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" hidden onChange={(e) => { const file = e.target.files?.[0]; up(`font-${r.key}`, file, (u) => setFont(r.key, { url: u, name: file?.name })); e.target.value = ''; }} />
                  </label>
                  <span className="ptb-sample" style={{ fontFamily: fontFamilyFor(f) }}>{r.sample}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ptb-section">
          <h2>Power-ups</h2>
          <p className="ptb-hint">The four default power-ups keep their action. Give each one this theme's name, picture and description. Added power-ups pick an action from the list; if none fits, choose Something new and describe the logic.</p>
          <div className="ptb-powers">
            {DEFAULT_POWERS.map((d) => {
              const o = draft.powers[d.id as PlinkoPower] ?? {};
              return (
                <div key={d.id} className="ptb-power-row">
                  <PowerPic img={o.img} fallback={DEFAULT_ICON[d.id]} magnet={d.id === 'magnet'} busy={busy === `p-${d.id}`} onFile={(f) => up(`p-${d.id}`, f, (u) => setPower(d.id as PlinkoPower, { img: u }))} onClear={o.img ? () => setPower(d.id as PlinkoPower, { img: '' }) : undefined} />
                  <label className="ptb-field">Name<input value={o.name ?? ''} placeholder={d.name} onChange={(e) => setPower(d.id as PlinkoPower, { name: e.target.value })} /></label>
                  <label className="ptb-field">Description<input value={o.does ?? ''} placeholder={d.does} onChange={(e) => setPower(d.id as PlinkoPower, { does: e.target.value })} /></label>
                  <div className="ptb-action"><small>Action</small><b>{kindText(d)}</b></div>
                </div>
              );
            })}
            {(draft.customPowers ?? []).map((p, i) => {
              const k = POWER_KINDS.find((x) => x.kind === p.kind);
              return (
                <div key={p.id} className="ptb-power-row added">
                  <PowerPic img={p.img} busy={busy === `c-${p.id}`} onFile={(f) => up(`c-${p.id}`, f, (u) => setCustom(i, { img: u }))} onClear={p.img ? () => setCustom(i, { img: undefined }) : undefined} />
                  <label className="ptb-field">Name <span className="ptb-req">Required</span><input value={p.name} placeholder="Super Smell" onChange={(e) => setCustom(i, { name: e.target.value })} /></label>
                  <label className="ptb-field">Description<input value={p.does} placeholder="What students read on the card" onChange={(e) => setCustom(i, { does: e.target.value })} /></label>
                  <label className="ptb-field">Action
                    <select value={p.kind} onChange={(e) => { const kind = e.target.value as PowerKind; const nk = POWER_KINDS.find((x) => x.kind === kind); setCustom(i, { kind, n: nk?.nDef }); }}>
                      {POWER_KINDS.map((x) => <option key={x.kind} value={x.kind}>{x.label}</option>)}
                    </select>
                  </label>
                  {k?.nLabel && <label className="ptb-field small">{k.nLabel}<input type="number" min={k.nMin} max={k.nMax} value={p.n ?? k.nDef} onChange={(e) => setCustom(i, { n: Math.max(k.nMin ?? 1, Math.min(k.nMax ?? 99, Number(e.target.value) || k.nDef || 1)) })} /></label>}
                  <label className="ptb-field wide">Logic {p.kind === 'none' && <span className="ptb-req">Required</span>}
                    <textarea rows={2} value={p.logic ?? ''} onChange={(e) => setCustom(i, { logic: e.target.value })}
                      placeholder={p.kind === 'none' ? 'Explain exactly what it does, for example: the ball sniffs out the bucket with a star and rolls toward it.' : 'Optional notes'} />
                  </label>
                  {p.kind === 'none' && <p className="ptb-note warn wide">Needs building. Saved with the theme, but students do not see it until its action is built. Mention it in chat to have it built.</p>}
                  <button type="button" className="btn btn-sm btn-danger ptb-remove" onClick={() => set({ customPowers: (draft.customPowers ?? []).filter((_, k2) => k2 !== i) })}>Remove</button>
                </div>
              );
            })}
            <button type="button" className="btn" onClick={() => set({ customPowers: [...(draft.customPowers ?? []), { id: makeId(), name: '', does: '', kind: 'multiply', n: 2 }] })}>Add a power-up</button>
            {unbuilt.length > 0 && <p className="ptb-hint">{unbuilt.length} power-up{unbuilt.length === 1 ? '' : 's'} waiting to be built.</p>}
          </div>
        </section>

        <details className="ptb-section ptb-import">
          <summary>Import from the Canva template</summary>
          <p className="ptb-hint">Fill the theme from the 6 page Canva template in one step. Everything it brings in can still be changed above.</p>
          <div className="row-wrap" style={{ gap: 10, alignItems: 'center' }}>
            <a className="btn btn-sm" href="/plinko/plinko-theme-template.pdf" download>Download the template</a>
            <label className="btn btn-sm">Choose the Canva PDF<input type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { importPdf(e.target.files?.[0]); e.target.value = ''; }} /></label>
            {pdfStep && <span className="ptb-hint">{pdfStep}</span>}
          </div>
        </details>

        <div className="ptb-footer">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => doSave()}>Save theme</button>
        </div>
      </div>
    </div>
  );
}

function PowerPic({ img, fallback, magnet, busy, onFile, onClear }: { img?: string; fallback?: string | null; magnet?: boolean; busy: boolean; onFile: (f: File) => void; onClear?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="ptb-pic">
      <button type="button" className="ptb-pic-btn" onClick={() => ref.current?.click()} aria-label={img ? 'Replace picture' : 'Upload picture'}>
        {img ? <img src={img} alt="" /> : fallback ? <img src={fallback} alt="" className="dim" /> : magnet ? <Magnet /> : <span>Picture</span>}
        {img && <span className="ptb-check"><Check /></span>}
      </button>
      <small>{busy ? 'Uploading...' : img ? <button type="button" className="ptb-link" onClick={onClear}>Use default</button> : 'Upload'}</small>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}
