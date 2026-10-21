import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import TeacherNav from '../../components/TeacherNav';
import GameTabs from './GameTabs';
import { makeId } from '../../lib/id';
import { uploadAudio, uploadImage } from '../../lib/upload';
import { PEG_SOUNDS, playPegSound } from '../../lib/miniSfx';
import { BALLS } from '../student/PlinkoSetup';
import {
  DEFAULT_PEG_COLORS, DEFAULT_POWERS, DEFAULT_THEME_ID, MAX_PEG_TYPES, PAGE_OF, SPEC_FIELDS, specOf, PLINKO_FONTS, POWER_KINDS, TEMPLATE_PAGES, buildTheme, cutTemplate, cutTemplatePage, fontFamilyFor, themeVars, usePlinkoThemes,
  type CutResult, type FontChoice, type PegColor, type PlinkoColorKey, type PlinkoPower, type PlinkoTheme, type PowerDef, type PowerKind,
} from '../../lib/plinkoThemes';

// The Plinko theme builder (Build Queue 296, her request: a Themes sub-tab in the teacher Game section, then a page
// for Plinko with a live preview of the game view on top, a row of upload cards that each show a check once filled,
// a color palette with hex codes, fonts for the title, headers and body (a preset or an uploaded font file), a 1x1
// cover, the four power-ups redesigned plus added ones with their logic, and Save). Anything left empty keeps the
// default Plinko look. Teacher-facing only, so plain and professional.

const UI = '/games/plinko/ui/';
const PG = '/plinko/pages/';
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
// Build Queue 312: the Default theme as a full theme she can edit, filled with everything the default game uses.
// Saved under the id "default", it becomes the game's default look (students still see it as Classic).
const urlOf = (bg: string) => /url\("([^"]+)"\)/.exec(bg)?.[1] ?? '';
const defaultDraft = (): PlinkoTheme => ({
  id: DEFAULT_THEME_ID, name: 'Default', font: 'default', approved: true, createdAt: new Date().toISOString(), cover: '/games/covers/plinko-drop.svg',
  balls: BALLS.map((b) => urlOf(b.bg)).filter(Boolean),
  colors: { primary: DEF.primary, secondary: DEF.secondary, text: DEF.text, panelBg: DEF.panel, boardBg: DEF.board, boardBorder: DEF.edge, peg: DEF.peg, zone: DEF.zone, powerBg: DEF.powerBg, powerBtn: DEF.powerBtn },
  buckets: [...BUCKET_DEF], powers: {}, customPowers: [], fonts: {}, pegColors: DEFAULT_PEG_COLORS.map((x) => ({ ...x })),
});
// One peg in the Game elements section: its color and its sound together.
function PegRow({ label, color, sound, busy, onColor, onSound, onUpload, onRemove }: { label: string; color: string; sound: string; busy: boolean; onColor: (v: string) => void; onSound: (v: string) => void; onUpload: () => void; onRemove?: () => void }) {
  const known = PEG_SOUNDS.some((x) => x.id === sound);
  return (
    <div className="ptb-pegrow">
      <span className="ptb-round">{label}</span>
      <input type="color" value={color} onChange={(e) => onColor(e.target.value)} aria-label={`${label} color`} />
      <select value={known ? sound : 'file'} aria-label={`${label} sound`} onChange={(e) => { if (e.target.value === 'upload') { onUpload(); return; } onSound(e.target.value); playPegSound(e.target.value); }}>
        {PEG_SOUNDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        {!known && <option value="file">My sound file</option>}
        <option value="upload">Upload a sound...</option>
      </select>
      <button type="button" className="btn btn-sm" onClick={() => playPegSound(sound)} aria-label={`Play the ${label} sound`}>{busy ? '...' : 'Play'}</button>
      {onRemove && <button type="button" className="ptb-link" onClick={onRemove}>Remove</button>}
    </div>
  );
}
// A new peg type: her first examples, then a fresh color and a different sound for each one after that.
const nextPeg = (n: number): PegColor => {
  if (n < PEG_START.length) return PEG_START[n];
  const h = (n * 47) % 360, f = (k: number) => { const a = 0.6 * Math.min(0.62, 1 - 0.62); const kk = (k + h / 30) % 12; return Math.round(255 * (0.62 - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1)))).toString(16).padStart(2, '0'); };
  return { color: `#${f(0)}${f(8)}${f(4)}`, sound: PEG_SOUNDS[(n * 3 + 1) % PEG_SOUNDS.length].id };
};
// The first peg colors offered (her examples: a pink peg barks, an orange peg farts).
const PEG_START: PegColor[] = [{ color: '#ff8ac4', sound: 'bark' }, { color: '#ff9f43', sound: 'fart' }, { color: '#7bd389', sound: 'boing' }, { color: '#9b8cff', sound: 'meow' }, { color: '#ffd93d', sound: 'ding' }, { color: '#4dc3ff', sound: 'splash' }];
const Check = () => <svg viewBox="0 0 20 20" width="20" height="20" aria-label="Done"><circle cx="10" cy="10" r="10" fill="#16a34a" /><path d="M5.5 10.5l3 3 6-7" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Magnet = ({ size = 30 }: { size?: number }) => <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden><path d="M8 5v11a8 8 0 0 0 16 0V5h-6v11a2 2 0 0 1-4 0V5z" fill="#127FB5" stroke="#6C626E" strokeWidth="1.2" /></svg>;
// Build Queue 301: a power-up's four rules (what it does, when, how the ball moves, with others) in one bubble.
const Rules = ({ p }: { p: PowerDef }) => { const sp = specOf(p); return SPEC_FIELDS.some((f) => sp[f.key]) ? <Info label={`Rules for ${p.name || 'this power-up'}`}>{SPEC_FIELDS.map((f) => sp[f.key] && <span key={f.key} className="ptb-pop-row"><b>{f.label}:</b> {sp[f.key]}</span>)}</Info> : null; };
const kindText = (p: PowerDef) => { const k = POWER_KINDS.find((x) => x.kind === p.kind); return k ? `${k.label}${k.nLabel ? ` (${k.nLabel.toLowerCase()} ${p.n ?? k.nDef})` : ''}` : ''; };

function useUpload() {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const up = async (key: string, file: File | undefined | null, done: (url: string) => void, audio = false) => {
    if (!file) return;
    setBusy(key); setErr(null);
    try { done(await (audio ? uploadAudio(file) : uploadImage(file))); } catch (e) { setErr(e instanceof Error ? e.message : 'The file could not be uploaded.'); }
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
        <span className="ptb-chip" style={{ background: c('secondary', DEF.secondary) }}>Round 2/5</span>
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
        </aside>
        <section className="ptb-board" style={{ background: t.board ? `center / cover url("${t.board}")` : c('boardBg', DEF.board), borderColor: c('boardBorder', DEF.edge) }}>
          <span className="ptb-turn" style={{ background: c('primary', DEF.primary) }}>Ava's turn</span>
          <div className="ptb-zones">{[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ background: c('zone', DEF.zone), borderColor: c('boardBorder', DEF.edge), color: c('text', DEF.text) }}>{n}</span>)}</div>
          <div className="ptb-pegs">{[5, 4, 5, 4, 5].map((n, r) => <div key={r} className="ptb-pegrow-p">{Array.from({ length: n }, (_, k) => { const i = r * 5 + k; const pegs = t.pegColors?.length ? t.pegColors : DEFAULT_PEG_COLORS; const pc = i % 3 === 1 ? pegs[Math.floor(i / 3) % pegs.length].color : undefined; return <i key={k} style={{ background: pc ?? c('peg', DEF.peg), animationDelay: `${-((i * 0.37) % 3)}s` }} />; })}</div>)}<b className="ptb-ball" style={{ background: ball(0) }} /></div>
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

// Build Queue 305: three side-by-side icon buttons on every image card.
const Ico = ({ d }: { d: React.ReactNode }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
const UP = <Ico d={<><path d="M12 15V4" /><path d="M7 9l5-5 5 5" /><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>} />;
const SCAN = <Ico d={<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="12" cy="12" r="3.2" /></>} />;
const DOWN = <Ico d={<><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>} />;

function ImageCard({ label, hint, required, value, busy, onFile, onClear, multiple, count, children, page, onScan, download }: {
  label: string; hint: string; required?: boolean; value?: string; busy: boolean; onFile: (f: FileList) => void; onClear?: () => void; multiple?: boolean; count?: string; children?: React.ReactNode;
  // Build Queue 297: read this card's template page from a photo, a picture or a PDF page.
  page?: number; onScan?: (f: File[]) => void; download?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const done = !!value || (count !== undefined && !required) || (!!count && !count.startsWith('0'));
  const full = !!value || (!!multiple && !!count && Number(count.split(' ')[0]) >= 5);
  // Build Queue 298: drop a picture straight onto the card, or tap the picture area to upload.
  return (
    <div className={`ptb-card${full ? ' filled' : ''}${drag ? ' drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) onFile(e.dataTransfer.files); }}>
      <div className="ptb-card-top">
        <b>{label}</b>
        <Info label={`About ${label}`}>{hint}</Info>
        {required && <span className="ptb-req">Required</span>}
        {full && <span className="ptb-check"><Check /></span>}
      </div>
      <button type="button" className="ptb-thumb" disabled={busy} onClick={() => ref.current?.click()} aria-label={`Upload ${label}`}>{children ?? (value ? <img src={value} alt="" /> : <span>Tap or drop a picture</span>)}</button>
      <div className="ptb-icons">
        <button type="button" className="ptb-ib primary" disabled={busy} onClick={() => ref.current?.click()} aria-label={`Upload ${label}`}>{UP}<span>{busy ? 'Uploading' : value || (multiple && done && count && !count.startsWith('0')) ? (multiple ? 'Add' : 'Replace') : 'Upload'}</span></button>
        {page && onScan && <button type="button" className="ptb-ib" onClick={() => scanRef.current?.click()} aria-label={multiple ? 'Scan the ball pages' : `Scan template page ${page}`}>{SCAN}<span>Scan</span></button>}
        {download && <a className="ptb-ib" href={download} download aria-label={`Download the ${label} template page`}>{DOWN}<span>Download</span></a>}
      </div>
      {(value || (multiple && count && !count.startsWith('0'))) && onClear && <button type="button" className="ptb-link ptb-clear" onClick={onClear}>Remove{multiple ? ' all' : ''}</button>}
      {onScan && <input ref={scanRef} type="file" accept="image/*,application/pdf" multiple={multiple} hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) onScan(f); e.target.value = ''; }} />}
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple={multiple} hidden onChange={(e) => { if (e.target.files?.length) onFile(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

// Build Queue 298: a small "i" that opens a short note on tap and closes on a tap anywhere else, in place of
// hint lines under every field.
function Info({ children, label = 'More info' }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <span ref={ref} className="ptb-info">
      <button type="button" aria-label={label} aria-expanded={open} onClick={(e) => { stop(e); setOpen((o) => !o); }}>i</button>
      {open && <span className="ptb-pop" role="note" onClick={stop}>{children}</span>}
    </span>
  );
}

// A collapsible section: the title row shows what is set so far, the body opens on tap.
function Fold({ title, meta, info, open, children }: { title: string; meta?: React.ReactNode; info?: React.ReactNode; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="ptb-fold" open={open}>
      <summary><span className="ptb-chev" aria-hidden /><h2>{title}</h2>{info && <Info label={`About ${title}`}>{info}</Info>}<span className="ptb-meta">{meta}</span></summary>
      <div className="ptb-fold-body">{children}</div>
    </details>
  );
}

function ColorField({ label, value, def, onChange }: { label: string; value?: string; def: string; onChange: (v?: string) => void }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  return (
    <div className="ptb-color">
      <input type="color" value={value ?? def} onChange={(e) => onChange(e.target.value)} aria-label={`${label} color`} />
      <div>
        <b>{label}</b>
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
  const isDefault = draft.id === DEFAULT_THEME_ID;
  const maxBalls = isDefault ? 30 : 10;
  const missing = isDefault ? [] : [!draft.name.trim() && 'a theme name', !draft.cover && 'a 1x1 cover', draft.balls.length < 5 && `at least 5 balls (${draft.balls.length} now)`].filter(Boolean) as string[];
  const unbuilt = (draft.customPowers ?? []).filter((p) => p.kind === 'none');
  const doSave = (approved = draft.approved) => {
    if (!draft.name.trim()) { setSaved('Give the theme a name first.'); return; }
    const t = { ...draft, approved: isDefault || (approved && missing.length === 0) };
    save(themes.some((x) => x.id === t.id) ? themes.map((x) => (x.id === t.id ? t : x)) : [t, ...themes]);
    setDraft(t); setDirty(false); setSaved(isDefault ? 'Saved. Every game uses this as the default look.' : t.approved ? 'Published. Students can pick this theme.' : 'Saved as a draft. Students do not see it yet.');
  };
  const setPower = (id: PlinkoPower, p: Partial<{ name: string; img: string; does: string }>) => set({ powers: { ...draft.powers, [id]: { ...draft.powers[id], ...p } } });
  const setCustom = (i: number, p: Partial<PowerDef>) => set({ customPowers: (draft.customPowers ?? []).map((x, k) => (k === i ? { ...x, ...p } : x)) });
  // Build Queue 297: bring designs in from the template, as the Canva PDF or as pictures or phone photos of the
  // printed pages (straightened by the corner squares). The whole template, or one page from a card.
  const merge = async (cutRes: CutResult) => {
    const t = await buildTheme(cutRes, { id: draft.id, name: draft.name, font: draft.font, powerNames: {} }, setPdfStep);
    set({ cover: t.cover ?? draft.cover, background: t.background ?? draft.background, board: t.board ?? draft.board, panel: t.panel ?? draft.panel, title: t.title ?? draft.title,
      balls: mergeBalls(t.balls, cutRes.ballSlots), colors: { ...draft.colors, ...t.colors }, buckets: t.buckets.some(Boolean) ? t.buckets : draft.buckets,
      powers: Object.fromEntries((['magnet', 'double', 'big', 'again'] as PlinkoPower[]).map((k) => [k, { ...draft.powers[k], ...(t.powers[k]?.img ? { img: t.powers[k]!.img } : {}) }])) });
  };
  // Each scanned ball keeps its slot (ball 3 replaces ball 3); a slot past the end is added at the end.
  const mergeBalls = (urls: string[], slots: number[]) => {
    const b = draft.balls.slice();
    urls.forEach((u, k) => { const i = slots[k] ?? k; if (i < b.length) b[i] = u; else b.push(u); });
    return b.slice(0, maxBalls);
  };
  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    try { await merge(await cutTemplate(files, setPdfStep)); setPdfStep('Imported. Check the preview, then Save.'); }
    catch (e) { setPdfStep(e instanceof Error ? e.message : 'The files could not be read.'); }
  };
  const scanPage = async (key: string, pageNo: number, files?: File[]) => {
    if (!files?.length) return;
    setPdfStep(null);
    try { await merge(await cutTemplatePage(files, pageNo, setPdfStep)); setPdfStep(files.length > 1 ? `${files.length} pages scanned.` : 'Page scanned.'); }
    catch (e) { setPdfStep(e instanceof Error ? e.message : 'That page could not be read.'); }
    void key;
  };
  const fonts = draft.fonts ?? {};
  const setFont = (k: 'title' | 'header' | 'body', f?: FontChoice) => set({ fonts: { ...fonts, [k]: f } });
  const imagesSet = [draft.cover, draft.balls.length >= 5, draft.background, draft.title, draft.board, draft.panel].filter(Boolean).length;
  const colorsSet = [...Object.values(draft.colors), ...draft.buckets].filter((c): c is string => !!c);
  const fontsMeta = FONT_ROLES.map((r) => { const f = fonts[r.key]; return f?.url ? f.name : PLINKO_FONTS.find((x) => x.id === f?.preset)?.label; }).filter(Boolean).join(', ') || 'Default';
  const pegColors = draft.pegColors ?? [];
  const setPeg = (i: number, p: Partial<PegColor>) => set({ pegColors: pegColors.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const pegInput = useRef<HTMLInputElement>(null);
  const pegFile = useRef<number | null>(null);
  const sorted = useMemo(() => themes.slice().sort((a, b) => a.name.localeCompare(b.name)), [themes]);

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack ptb">
        <GameTabs />
        <nav className="ptb-crumbs" aria-label="Breadcrumb"><Link to="/teacher/game/themes">Themes</Link><span>/</span><b>Plinko</b></nav>

        <div className="ptb-themes" aria-label="Saved themes">
          <button type="button" className={`ptb-theme${isDefault ? ' on' : ''}`} onClick={() => open(themes.find((x) => x.id === DEFAULT_THEME_ID) ?? defaultDraft())}>
            <span style={{ background: `center / cover url("${themes.find((x) => x.id === DEFAULT_THEME_ID)?.cover ?? '/games/covers/plinko-drop.svg'}")` }} />
            <b>Default</b><small className="live">Always on</small>
          </button>
          {sorted.filter((t) => t.id !== DEFAULT_THEME_ID).map((t) => (
            <button key={t.id} type="button" className={`ptb-theme${t.id === draft.id ? ' on' : ''}`} onClick={() => open(t)}>
              <span style={{ background: t.cover ? `center / cover url("${t.cover}")` : '#eef0f4' }} />
              <b>{t.name}</b><small className={t.approved ? 'live' : ''}>{t.approved ? 'Live' : 'Draft'}</small>
            </button>
          ))}
          <button type="button" className="ptb-theme new" onClick={() => open()}><span>+</span><b>New theme</b></button>
        </div>

        <section className="ptb-bar content-well">
          <label className="ptb-field"><span>Theme name <span className="ptb-req">Required</span></span>
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Winter, Dogs, Space..." />
          </label>
          <label className="ptb-field">Made by
            <input value={draft.madeBy ?? ''} onChange={(e) => set({ madeBy: e.target.value || undefined })} placeholder="Optional" />
          </label>
          <div className="ptb-actions">
            {/* Build Queue 302 (her words: "instead of share with students, show publish button"). */}
            {isDefault ? (
              <>
                <button type="button" className="btn btn-primary" onClick={() => doSave()}>Save</button>
                <button type="button" className="btn" onClick={() => { if (window.confirm('Put the Default theme back the way it started?')) set(defaultDraft()); }}>Reset</button>
                <Info label="About the Default theme">The Default theme is the look every game uses unless a student picks another theme. Change anything, then Save. Reset puts everything back to the original.</Info>
              </>
            ) : (
              <>
                {draft.approved && <span className="ptb-live">Published</span>}
                <button type="button" className="btn" onClick={() => doSave()}>{draft.approved ? 'Save' : 'Save draft'}</button>
                {draft.approved
                  ? <button type="button" className="btn" onClick={() => doSave(false)}>Unpublish</button>
                  : <button type="button" className="btn btn-primary" disabled={missing.length > 0} onClick={() => doSave(true)}>Publish</button>}
                <Info label="About publishing">Publish shows the theme to students. It needs a name, a cover and at least 5 balls. Unpublish hides it again. A draft can be saved any time.</Info>
              </>
            )}
            {!isDefault && themes.some((x) => x.id === draft.id) && <button type="button" className="btn btn-danger" onClick={() => { if (window.confirm(`Delete the ${draft.name} theme?`)) { save(themes.filter((x) => x.id !== draft.id)); setDraft(blank()); setDirty(false); } }}>Delete</button>}
          </div>
          {(missing.length > 0 || dirty || saved || err) && (
            <div className="ptb-notes">
              {missing.length > 0 && <span className="ptb-note">Needed to publish: {missing.join(', ')}</span>}
              {dirty && <span className="ptb-note warn">Not saved</span>}
              {saved && <span className="ptb-note ok" role="status">{saved}</span>}
              {err && <span className="ptb-note bad" role="alert">{err}</span>}
            </div>
          )}
        </section>

        <div className="ptb-layout">
          <div className="ptb-stage">
            <Preview t={draft} />
            <div className="ptb-template">
              <b>Template</b>
              <Info label="About the template">
                {TEMPLATE_PAGES} pages, 11 x 8.5 in. Print it to draw by hand, or put each page in Canva and lock it. One item per page. Upload the Canva PDF, pictures, or photos of the pages in any order. Keep all four corner squares in each photo.
              </Info>
              <a className="btn btn-sm" href="/plinko/plinko-theme-template.pdf" download>Download</a>
              <label className="btn btn-sm btn-primary">Upload PDF or pictures<input type="file" accept="application/pdf,image/*" multiple hidden onChange={(e) => { importFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label>
              <label className="btn btn-sm">Take photos<input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { importFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label>
              {pdfStep && <span className="ptb-hint" role="status">{pdfStep}</span>}
            </div>
          </div>

          <div className="ptb-folds">
            <Fold title="Images" open meta={`${imagesSet} of 6`} info="Tap a card or drop a picture on it. Scan reads that part from a photo of its template page. Anything empty keeps the default look.">
              <div className="ptb-cards">
                <ImageCard download={`${PG}page-${PAGE_OF.cover}.pdf`} page={PAGE_OF.cover} onScan={(f) => scanPage('cover', PAGE_OF.cover, f)} label="Cover" required hint="Square (1:1). Students see it when they pick a theme." value={draft.cover} busy={busy === 'cover'} onFile={(f) => up('cover', f[0], (u) => set({ cover: u }))} onClear={() => set({ cover: undefined })}>
                  {draft.cover ? <img src={draft.cover} alt="" className="sq" /> : <span>Tap or drop a picture</span>}
                </ImageCard>
                <ImageCard download={`${PG}balls.pdf`} page={PAGE_OF.balls} onScan={(f) => scanPage('balls', PAGE_OF.balls, f)} label="Balls" required multiple hint="Square PNGs with see-through corners. At least 5. Tap a ball to remove it." count={`${draft.balls.length} of ${maxBalls}`} busy={busy === 'balls'}
                  onFile={async (fl) => { const files = Array.from(fl).slice(0, maxBalls - draft.balls.length); const urls: string[] = []; for (const f of files) await up('balls', f, (u) => urls.push(u)); if (urls.length) set({ balls: [...draft.balls, ...urls].slice(0, maxBalls) }); }}
                  onClear={() => set({ balls: [] })}>
                  {draft.balls.length ? <div className="ptb-balls">{draft.balls.map((b, i) => <span key={i} role="button" tabIndex={0} title="Remove this ball" onClick={(e) => { e.stopPropagation(); set({ balls: draft.balls.filter((_, k) => k !== i) }); }}><img src={b} alt={`Ball ${i + 1}`} /></span>)}</div> : <span>Tap or drop pictures</span>}
                  <small className="ptb-count">{draft.balls.length} of {maxBalls}</small>
                </ImageCard>
                <ImageCard download={`${PG}page-${PAGE_OF.background}.pdf`} page={PAGE_OF.background} onScan={(f) => scanPage('background', PAGE_OF.background, f)} label="Background" hint="Fills the screen behind the game. Landscape, about 2048 x 1536." value={draft.background} busy={busy === 'background'} onFile={(f) => up('background', f[0], (u) => set({ background: u }))} onClear={() => set({ background: undefined })} />
                <ImageCard download={`${PG}page-${PAGE_OF.title}.pdf`} page={PAGE_OF.title} onScan={(f) => scanPage('title', PAGE_OF.title, f)} label="Title" hint="The game name as a PNG with a see-through background." value={draft.title} busy={busy === 'title'} onFile={(f) => up('title', f[0], (u) => set({ title: u }))} onClear={() => set({ title: undefined })} />
                <ImageCard download={`${PG}page-${PAGE_OF.board}.pdf`} page={PAGE_OF.board} onScan={(f) => scanPage('board', PAGE_OF.board, f)} label="Board" hint="Behind the pegs. Portrait or square." value={draft.board} busy={busy === 'board'} onFile={(f) => up('board', f[0], (u) => set({ board: u }))} onClear={() => set({ board: undefined })} />
                <ImageCard download={`${PG}page-${PAGE_OF.panel}.pdf`} page={PAGE_OF.panel} onScan={(f) => scanPage('panel', PAGE_OF.panel, f)} label="Side panels" hint="Behind the scoreboard and power-ups. Keep the middle calm so the text stays easy to read." value={draft.panel} busy={busy === 'panel'} onFile={(f) => up('panel', f[0], (u) => set({ panel: u }))} onClear={() => set({ panel: undefined })} />
              </div>
            </Fold>

            <Fold title="Colors" meta={<span className="ptb-swatches">{colorsSet.length ? colorsSet.map((c, i) => <i key={i} style={{ background: c }} />) : 'Default'}</span>}
              info={<>Pick a color or type a hex code.{COLORS.map((c) => <span key={c.key} className="ptb-pop-row"><b>{c.label}:</b> {c.hint}</span>)}<span className="ptb-pop-row"><b>Buckets:</b> 1 to 3 show from round 1, then one more each round.</span></>}>
              <div className="ptb-colors">
                {COLORS.map((c) => <ColorField key={c.key} label={c.label} def={c.def} value={draft.colors[c.key]} onChange={(v) => set({ colors: { ...draft.colors, [c.key]: v } })} />)}
              </div>
              <h3>Buckets</h3>
              <div className="ptb-colors">
                {BUCKET_DEF.map((d, i) => <ColorField key={i} label={`Bucket ${i + 1}`} def={d} value={draft.buckets[i] ?? undefined}
                  onChange={(v) => { const b = [...draft.buckets]; while (b.length < 8) b.push(null); b[i] = v ?? null; set({ buckets: b }); }} />)}
              </div>
            </Fold>

            {/* Build Queue 306 (her words: "no colors for pegs in colors section. but rather have a section for "Game elements" that has a
                second for pegs where i can define the color and sound for each peg in one"). */}
            <Fold title="Game elements" meta={`${pegColors.length + 1} peg${pegColors.length ? 's' : ''}`}
              info="Pegs: the plain pegs are on the board from the start. Add up to 20 peg types. Each round one more type joins the board, picked at random, so every game mixes them differently. Each one makes its sound when the ball bounces off it. Sounds never change the points.">
              <h3>Pegs</h3>
              <div className="ptb-pegrows">
                <PegRow label="Plain pegs" color={draft.colors.peg ?? DEF.peg} sound={draft.pegSound ?? 'tick'} busy={busy === 'peg-plain'}
                  onColor={(v) => set({ colors: { ...draft.colors, peg: v } })} onSound={(v) => set({ pegSound: v })} onUpload={() => { pegFile.current = -1; pegInput.current?.click(); }} />
                {pegColors.map((pc, i) => (
                  <PegRow key={i} label={`Peg ${i + 1}`} color={pc.color} sound={pc.sound} busy={busy === `peg-${i}`}
                    onColor={(v) => setPeg(i, { color: v })} onSound={(v) => setPeg(i, { sound: v })} onUpload={() => { pegFile.current = i; pegInput.current?.click(); }}
                    onRemove={() => set({ pegColors: pegColors.filter((_, k) => k !== i) })} />
                ))}
                {pegColors.length < MAX_PEG_TYPES && <button type="button" className="btn btn-sm" onClick={() => set({ pegColors: [...pegColors, nextPeg(pegColors.length)] })}>Add a peg type ({pegColors.length} of {MAX_PEG_TYPES})</button>}
                <input ref={pegInput} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac" hidden onChange={(e) => { const i = pegFile.current; const f = e.target.files?.[0]; if (i === -1) up('peg-plain', f, (u) => set({ pegSound: u }), true); else if (i !== null) up(`peg-${i}`, f, (u) => setPeg(i, { sound: u }), true); e.target.value = ''; }} />
              </div>
            </Fold>

            <Fold title="Music" meta={draft.music ? 'Song added' : 'None'} info="One song plays quietly in the background for the whole game. MP3 or M4A works best.">
              <div className="ptb-music">
                {draft.music ? <audio src={draft.music} controls preload="none" /> : <span className="ptb-hint">No song yet</span>}
                <label className="btn btn-sm btn-primary">{busy === 'music' ? 'Uploading...' : draft.music ? 'Replace' : 'Upload song'}
                  <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac" hidden onChange={(e) => { up('music', e.target.files?.[0], (u) => set({ music: u }), true); e.target.value = ''; }} />
                </label>
                {draft.music && <button type="button" className="btn btn-sm" onClick={() => set({ music: undefined })}>Remove</button>}
              </div>
            </Fold>

            <Fold title="Fonts" meta={fontsMeta} info="Pick a font for each part, or upload a font file (TTF, OTF, WOFF).">
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
                      <label className="btn btn-sm">{busy === `font-${r.key}` ? 'Uploading...' : 'Upload'}
                        <input type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" hidden onChange={(e) => { const file = e.target.files?.[0]; up(`font-${r.key}`, file, (u) => setFont(r.key, { url: u, name: file?.name })); e.target.value = ''; }} />
                      </label>
                      <span className="ptb-sample" style={{ fontFamily: fontFamilyFor(f) }}>{r.sample}</span>
                    </div>
                  );
                })}
              </div>
            </Fold>

            <Fold title="Power-ups" meta={`${DEFAULT_POWERS.length + (draft.customPowers ?? []).length}${unbuilt.length ? `, ${unbuilt.length} to build` : ''}`}
              info="The four default power-ups keep their action; give each one this theme's name, picture and description. An added power-up picks an action from the list. If none fits, choose Something new and describe the logic; it is built before students see it.">
              <div className="ptb-powers">
                {DEFAULT_POWERS.map((d) => {
                  const o = draft.powers[d.id as PlinkoPower] ?? {};
                  return (
                    <div key={d.id} className="ptb-power-row">
                      <PowerPic img={o.img} fallback={DEFAULT_ICON[d.id]} magnet={d.id === 'magnet'} busy={busy === `p-${d.id}`} onFile={(f) => up(`p-${d.id}`, f, (u) => setPower(d.id as PlinkoPower, { img: u }))} onClear={o.img ? () => setPower(d.id as PlinkoPower, { img: '' }) : undefined} />
                      <label className="ptb-field">Name<input value={o.name ?? ''} placeholder={d.name} onChange={(e) => setPower(d.id as PlinkoPower, { name: e.target.value })} /></label>
                      <label className="ptb-field">Description<input value={o.does ?? ''} placeholder={d.does} onChange={(e) => setPower(d.id as PlinkoPower, { does: e.target.value })} /></label>
                      <div className="ptb-action"><small>Action</small><b>{kindText(d)}</b><Rules p={d} /></div>
                    </div>
                  );
                })}
                {(draft.customPowers ?? []).map((p, i) => {
                  const k = POWER_KINDS.find((x) => x.kind === p.kind);
                  return (
                    <div key={p.id} className="ptb-power-row added">
                      <PowerPic img={p.img} busy={busy === `c-${p.id}`} onFile={(f) => up(`c-${p.id}`, f, (u) => setCustom(i, { img: u }))} onClear={p.img ? () => setCustom(i, { img: undefined }) : undefined} />
                      <label className="ptb-field"><span>Name <span className="ptb-req">Required</span></span><input value={p.name} placeholder="Super Smell" onChange={(e) => setCustom(i, { name: e.target.value })} /></label>
                      <label className="ptb-field">Description<input value={p.does} placeholder="On the card" onChange={(e) => setCustom(i, { does: e.target.value })} /></label>
                      <label className="ptb-field">Action
                        <select value={p.kind} onChange={(e) => { const kind = e.target.value as PowerKind; const nk = POWER_KINDS.find((x) => x.kind === kind); setCustom(i, { kind, n: nk?.nDef }); }}>
                          {POWER_KINDS.map((x) => <option key={x.kind} value={x.kind}>{x.label}</option>)}
                        </select>
                      </label>
                      {p.kind !== 'none' && <div className="ptb-action"><small>Rules</small><Rules p={p} /></div>}
                      {k?.nLabel && <label className="ptb-field small">{k.nLabel}<input type="number" min={k.nMin} max={k.nMax} value={p.n ?? k.nDef} onChange={(e) => setCustom(i, { n: Math.max(k.nMin ?? 1, Math.min(k.nMax ?? 99, Number(e.target.value) || k.nDef || 1)) })} /></label>}
                      {p.kind === 'none' ? (
                        <div className="ptb-spec wide">
                          {SPEC_FIELDS.map((f) => (
                            <label key={f.key} className="ptb-field"><span>{f.label} {f.key === 'does' && <span className="ptb-req">Required</span>}</span>
                              <textarea rows={2} value={p.spec?.[f.key] ?? (f.key === 'does' ? p.logic ?? '' : '')} placeholder={f.ask} onChange={(e) => setCustom(i, { spec: { ...p.spec, [f.key]: e.target.value } })} />
                            </label>
                          ))}
                        </div>
                      ) : (
                        <label className="ptb-field wide">Notes<textarea rows={1} value={p.logic ?? ''} onChange={(e) => setCustom(i, { logic: e.target.value })} placeholder="Optional" /></label>
                      )}
                      {p.kind === 'none' && <p className="ptb-note warn wide">Needs building. Students see it once it is built; mention it in chat.</p>}
                      <button type="button" className="btn btn-sm btn-danger ptb-remove" onClick={() => set({ customPowers: (draft.customPowers ?? []).filter((_, k2) => k2 !== i) })}>Remove</button>
                    </div>
                  );
                })}
                <button type="button" className="btn btn-sm" onClick={() => set({ customPowers: [...(draft.customPowers ?? []), { id: makeId(), name: '', does: '', kind: 'multiply', n: 2 }] })}>Add a power-up</button>
              </div>
            </Fold>
          </div>
        </div>

        <div className="ptb-footer">
          <button type="button" className="btn btn-lg" onClick={() => doSave()}>{draft.approved ? 'Save' : 'Save draft'}</button>
          {!draft.approved && <button type="button" className="btn btn-primary btn-lg" disabled={missing.length > 0} onClick={() => doSave(true)}>Publish</button>}
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
