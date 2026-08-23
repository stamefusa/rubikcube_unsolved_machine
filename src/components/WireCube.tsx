export function WireCube() {
  return (
    <div className="cube-visual" aria-label="Scanning cube geometry">
      <div className="radar-ring ring-a" /><div className="radar-ring ring-b" />
      <div className="scan-beam" />
      <div className="wire-cube">
        <div className="cube-face cube-front"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="cube-face cube-right"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="cube-face cube-top"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
      </div>
      <span className="data-tag tag-a">X 047.193</span><span className="data-tag tag-b">VTX 08/08</span>
      <span className="data-tag tag-c">ROT 142.6°</span><span className="data-tag tag-d">LOCKED</span>
    </div>
  );
}
