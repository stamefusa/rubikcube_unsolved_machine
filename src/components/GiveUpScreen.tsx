interface Props { error: string | null; moveCount: number; onReset: () => void }

export function GiveUpScreen({ error, moveCount, onReset }: Props) {
  return (
    <main className="screen giveup-screen">
      <div className="failure-noise" />
      <section className="failure-card">
        <div className="failure-icon">!</div>
        <span className="failure-label">SOLVING STATUS</span>
        <h2>{error ? "SYSTEM HALT" : "FAILED"}</h2>
        <p>{error ?? "SOLUTION COULD NOT BE COMPLETED"}</p>
        <div className="failure-stats"><span>ATTEMPTED MOVES</span><b>{String(moveCount).padStart(2, "0")}</b><span>CONFIDENCE</span><b>0.00%</b></div>
        <button className="primary-button reset-button" onClick={onReset}><span>↻</span> RESET SYSTEM</button>
      </section>
    </main>
  );
}
