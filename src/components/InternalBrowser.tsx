interface Props {
  url: string;
  title: string;
  onClose: () => void;
}

export default function InternalBrowser({ url, title, onClose }: Props) {
  return (
    <div className="overlay-backdrop" style={{ padding: 0 }} onClick={onClose}>
      <div
        className="chrome-frame stack"
        style={{ width: '95vw', height: '92vh', padding: 0, gap: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-between" style={{ padding: '10px 16px', background: 'var(--ink)' }}>
          <strong style={{ color: 'white' }}>{title}</strong>
          <div className="row-wrap">
            <a className="btn btn-sm btn-teal" href={url} target="_blank" rel="noopener noreferrer">
              🔗 Open in new tab
            </a>
            <button className="btn btn-sm" onClick={onClose}>✕ Close</button>
          </div>
        </div>
        <iframe src={url} title={title} className="internal-browser-frame" />
        <div style={{ padding: '6px 16px', fontSize: '0.75rem', opacity: 0.65, background: '#f4effe' }}>
          Not loading? Some sites don't allow being shown inside another page — tap "Open in new tab" above instead.
        </div>
      </div>
    </div>
  );
}
