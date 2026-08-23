interface Props { value: number; label?: string; overflow?: boolean }

export function ProgressBar({ value, label, overflow = false }: Props) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={`progress-wrap ${overflow ? "overflow" : ""}`}>
      {label && <div className="progress-label"><span>{label}</span><span>{Math.round(value)}%</span></div>}
      <div className="progress-track"><span style={{ width: `${clamped}%` }} /></div>
    </div>
  );
}
