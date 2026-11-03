import { useEffect, useRef, useState } from 'react';

// A settings section in list form (Build Queue 501, her words: "add a settings tab that can be collapsed but starts as
// expanded. make clear what settings are, add hover text explanation. add i list form"): one row per setting with a
// checkbox, its name, a one line plain description, and an ⓘ that shows the full explanation on hover or tap.
export interface SettingItem { key: string; icon?: string; label: string; desc: string; help: string; checked: boolean; onChange: (on: boolean) => void }

export function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <span ref={ref} className="set-info" onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true); }} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOpen(false); }}>
      <button type="button" className="set-info-btn" aria-label={`What is ${label}?`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>i</button>
      {open && <span className="set-info-tip" role="tooltip"><b>{label}</b>{text}</span>}
    </span>
  );
}

// lead: something shown before the title (the step number on the New question set page).
export default function SettingsList({ title, items, note, defaultOpen = true, lead }: { title: string; items: SettingItem[]; note?: string; defaultOpen?: boolean; lead?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const on = items.filter((i) => i.checked).length;
  return (
    <section className={`set-list${open ? ' open' : ''}`}>
      <button type="button" className="set-list-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {lead}<span className="set-list-title">{title}</span>
        <small>{on} of {items.length} on</small>
        <i aria-hidden>▾</i>
      </button>
      {open && (
        <ul className="set-list-rows">
          {items.map((it) => (
            <li key={it.key} className={`set-row${it.checked ? ' on' : ''}`}>
              {/* Build Queue 504: just the name in the row; what it does shows on hover and in the ⓘ. */}
              <label className="set-row-main" title={it.desc}>
                <input type="checkbox" checked={it.checked} onChange={(e) => it.onChange(e.target.checked)} />
                <span className="set-row-text"><b>{it.label}</b></span>
              </label>
              <InfoTip label={it.label} text={`${it.desc} ${it.help}`} />
            </li>
          ))}
          {note && <li className="set-list-note">{note}</li>}
        </ul>
      )}
    </section>
  );
}
