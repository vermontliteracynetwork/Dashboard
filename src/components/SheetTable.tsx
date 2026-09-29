import { useMemo, useRef, useState } from 'react';

// A Google Sheets-style grid for editing a list of assets in place
// (direct teacher instruction: "google sheets style for editing assets in
// list view, in addition to the full asset viewer"). Shared by the
// Marketplace Manager and Build Mode's Placed Objects list so both behave
// the same: every cell is directly editable, text/number edits commit on
// Enter or leaving the cell (Escape cancels), arrow Up/Down and Enter move
// between rows like a spreadsheet, headers sort, and the header row and
// first column stay pinned while scrolling.

export type SheetColumn<Row> = {
  key: string;
  label: string;
  width?: number;
  get: (row: Row) => string | number | boolean | null | undefined;
  sortValue?: (row: Row) => string | number;
} & (
  | { type: 'text' | 'number' | 'money' | 'date'; set: (row: Row, value: string) => void; placeholder?: (row: Row) => string }
  | { type: 'select'; set: (row: Row, value: string) => void; options: { value: string; label: string }[] }
  | { type: 'checkbox'; set: (row: Row, value: boolean) => void }
  | { type: 'color'; set: (row: Row, value: string | null) => void }
  | { type: 'readonly'; render?: (row: Row) => React.ReactNode }
);

function cellId(tableId: string, rowIndex: number, colIndex: number) {
  return `${tableId}-r${rowIndex}-c${colIndex}`;
}

function focusCell(tableId: string, rowIndex: number, colIndex: number) {
  const el = document.getElementById(cellId(tableId, rowIndex, colIndex));
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    el.focus();
    if (el instanceof HTMLInputElement && el.type !== 'checkbox' && el.type !== 'color') el.select();
  }
}

export function SheetTable<Row>({ tableId, rows, rowKey, columns, onDelete, emptyText }: {
  tableId: string;
  rows: Row[];
  rowKey: (row: Row) => string;
  columns: SheetColumn<Row>[];
  onDelete?: (row: Row) => void;
  emptyText?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const confirmTimer = useRef<number | null>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const val = (r: Row) => {
      const v = col.sortValue ? col.sortValue(r) : col.get(r);
      return typeof v === 'number' ? v : String(v ?? '').toLowerCase();
    };
    return [...rows].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [rows, columns, sort]);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));

  const onCellKeyDown = (e: React.KeyboardEvent<HTMLElement>, r: number, c: number) => {
    const target = e.currentTarget;
    const isText = target instanceof HTMLInputElement && !['checkbox', 'color', 'date'].includes(target.type);
    if (e.key === 'Escape' && target instanceof HTMLInputElement) {
      target.value = target.defaultValue;
      target.blur();
      return;
    }
    if (e.key === 'Enter' || (e.key === 'ArrowDown' && isText)) {
      e.preventDefault();
      if (isText) (target as HTMLInputElement).blur();
      focusCell(tableId, Math.min(sortedRows.length - 1, r + (e.shiftKey ? -1 : 1)), c);
    } else if (e.key === 'ArrowUp' && isText) {
      e.preventDefault();
      (target as HTMLInputElement).blur();
      focusCell(tableId, Math.max(0, r - 1), c);
    }
  };

  if (rows.length === 0) return <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>{emptyText ?? 'Nothing here yet.'}</p>;

  return (
    <div className="sheet-wrap" role="region" aria-label="Spreadsheet view" tabIndex={0}>
      <table className="sheet">
        <thead>
          <tr>
            <th className="sheet-rownum" aria-label="Row number" />
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { minWidth: col.width } : undefined}>
                <button type="button" className="sheet-sort" onClick={() => toggleSort(col.key)}>
                  {col.label}
                  <span aria-hidden="true">{sort?.key === col.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
                </button>
              </th>
            ))}
            {onDelete && <th aria-label="Delete" />}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, r) => {
            const key = rowKey(row);
            return (
              <tr key={key}>
                <td className="sheet-rownum">{r + 1}</td>
                {columns.map((col, c) => {
                  const id = cellId(tableId, r, c);
                  const value = col.get(row);
                  const label = `${col.label}, row ${r + 1}`;
                  switch (col.type) {
                    case 'readonly':
                      return <td key={col.key} className="sheet-readonly">{col.render ? col.render(row) : String(value ?? '')}</td>;
                    case 'checkbox':
                      return (
                        <td key={col.key} className="sheet-center">
                          <input id={id} type="checkbox" aria-label={label} checked={!!value} onChange={(e) => col.set(row, e.target.checked)} onKeyDown={(e) => onCellKeyDown(e, r, c)} />
                        </td>
                      );
                    case 'select':
                      return (
                        <td key={col.key}>
                          <select id={id} aria-label={label} value={String(value ?? '')} onChange={(e) => col.set(row, e.target.value)} onKeyDown={(e) => onCellKeyDown(e, r, c)}>
                            {col.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                      );
                    case 'color':
                      return (
                        <td key={col.key} className="sheet-center">
                          <span className="sheet-color">
                            <input id={id} type="color" aria-label={label} value={typeof value === 'string' && value ? value : '#ffffff'} onChange={(e) => col.set(row, e.target.value)} onKeyDown={(e) => onCellKeyDown(e, r, c)} />
                            {value ? <button type="button" className="sheet-clear" aria-label={`Clear ${label}`} onClick={() => col.set(row, null)}>✕</button> : null}
                          </span>
                        </td>
                      );
                    default: {
                      const shown = col.type === 'money' && typeof value === 'number' ? (value / 100).toFixed(2) : String(value ?? '');
                      return (
                        <td key={col.key} className={col.type === 'money' ? 'sheet-money' : undefined}>
                          {col.type === 'money' && <span className="sheet-prefix" aria-hidden="true">$</span>}
                          <input
                            // Uncontrolled + keyed on the stored value, so a
                            // realtime update from another tab replaces the
                            // cell, but typing never fights a re-render.
                            key={shown}
                            id={id}
                            aria-label={label}
                            type={col.type === 'date' ? 'date' : col.type === 'text' ? 'text' : 'number'}
                            step={col.type === 'money' ? 0.25 : col.type === 'number' ? 'any' : undefined}
                            defaultValue={shown}
                            placeholder={col.placeholder?.(row)}
                            onBlur={(e) => { if (e.target.value !== shown) col.set(row, e.target.value); }}
                            onKeyDown={(e) => onCellKeyDown(e, r, c)}
                          />
                        </td>
                      );
                    }
                  }
                })}
                {onDelete && (
                  <td className="sheet-center">
                    <button
                      type="button"
                      className={`sheet-delete${confirmDeleteKey === key ? ' confirm' : ''}`}
                      aria-label={confirmDeleteKey === key ? 'Tap again to delete' : `Delete row ${r + 1}`}
                      onClick={() => {
                        if (confirmDeleteKey === key) {
                          onDelete(row);
                          setConfirmDeleteKey(null);
                          return;
                        }
                        setConfirmDeleteKey(key);
                        if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
                        confirmTimer.current = window.setTimeout(() => setConfirmDeleteKey(null), 2500);
                      }}
                    >
                      {confirmDeleteKey === key ? 'Sure?' : '🗑️'}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Cards / Sheet switch shown above a list that has both views.
export function ViewToggle({ value, onChange }: { value: 'cards' | 'sheet'; onChange: (v: 'cards' | 'sheet') => void }) {
  return (
    <div className="view-toggle" role="group" aria-label="View">
      <button type="button" className={value === 'cards' ? 'active' : ''} aria-pressed={value === 'cards'} onClick={() => onChange('cards')}>▦ Full view</button>
      <button type="button" className={value === 'sheet' ? 'active' : ''} aria-pressed={value === 'sheet'} onClick={() => onChange('sheet')}>☰ Sheet</button>
    </div>
  );
}
