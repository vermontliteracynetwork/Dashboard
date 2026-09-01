interface Props {
  done: number;
  total: number;
}

export default function SubjectProgressBar({ done, total }: Props) {
  if (total === 0) return null;
  return (
    <div className="content-well" style={{ padding: '12px 18px' }}>
      <div className="progress-bar-label">🏁 {done} of {total} done</div>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}
