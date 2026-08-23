interface Props { value: number; label?: string; overflow?: boolean; nominalWidthPercent?: number; overflowMultiplier?: number }

export function ProgressBar({ value, label, overflow = false, nominalWidthPercent = 100, overflowMultiplier = 1 }: Props) {
  const normalizedNominalWidth = Math.min(100, Math.max(1, nominalWidthPercent));
  const normalizedValue = overflow ? Math.max(0, value) : Math.min(100, Math.max(0, value));
  const acceleratedValue = normalizedValue > 100
    ? 100 + (normalizedValue - 100) * Math.max(1, overflowMultiplier)
    : normalizedValue;
  const renderedWidth = acceleratedValue * normalizedNominalWidth / 100;
  const hasRunway = normalizedNominalWidth < 100;
  return (
    <div className={`progress-wrap ${overflow ? "overflow" : ""} ${hasRunway ? "has-runway" : ""}`}>
      {label && <div className="progress-label"><span>{label}</span><span>{Math.round(value)}%</span></div>}
      <div className="progress-track">
        {hasRunway && <>
          <i className="progress-overrun-zone" style={{ left: `${normalizedNominalWidth}%` }} />
          <i className="progress-nominal-marker" style={{ left: `${normalizedNominalWidth}%` }}><em>100%</em></i>
        </>}
        <span style={{ width: `${renderedWidth}%` }}><b className="progress-leading-edge" /></span>
      </div>
    </div>
  );
}
