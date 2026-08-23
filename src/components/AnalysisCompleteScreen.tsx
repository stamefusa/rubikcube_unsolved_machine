interface Props { estimatedMoves: number; onExecute: () => void }

export function AnalysisCompleteScreen({ estimatedMoves, onExecute }: Props) {
  return (
    <main className="screen complete-screen">
      <div className="success-burst" aria-hidden="true"><i /><i /><i /></div>
      <section className="complete-card">
        <div className="success-code">SOLUTION VECTOR LOCKED // 0x8F</div>
        <div className="complete-check">✓</div>
        <h2>ANALYSIS<br /><strong>COMPLETE</strong></h2>
        <p>OPTIMAL SOLUTION FOUND</p>
        <div className="result-grid">
          <div><span>ESTIMATED SEQUENCE</span><b>{estimatedMoves}</b><small>MOVES</small></div>
          <div><span>CONFIDENCE INDEX</span><b>100</b><small>%</small></div>
          <div><span>PATH INTEGRITY</span><b>100</b><small>%</small></div>
        </div>
        <button className="primary-button execute-button" onClick={onExecute}><span>03</span> EXECUTE SOLUTION</button>
      </section>
    </main>
  );
}
