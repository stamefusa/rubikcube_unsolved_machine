import type { ShowState } from "../show/showState";

interface Props { state: ShowState; error: string | null; moveCount: number; recovering: boolean; onReset: () => void }

export function GiveUpScreen({ state, error, moveCount, recovering, onReset }: Props) {
  const ending = state === "endingDemo";
  return (
    <main className="screen giveup-screen">
      <div className="failure-noise" />
      <section className="failure-card">
        <div className="failure-icon">!</div>
        <span className="failure-label">SOLVING STATUS</span>
        <h2>{error ? "SYSTEM HALT" : ending ? "RELEASING" : "FAILED"}</h2>
        <p>{error ?? (ending ? "CUBE RELEASE SEQUENCE ACTIVE" : "SOLUTION COULD NOT BE COMPLETED")}</p>
        <div className="failure-stats"><span>ATTEMPTED MOVES</span><b>{String(moveCount).padStart(2, "0")}</b><span>CONFIDENCE</span><b>0.00%</b></div>
        {state === "error" && (
          <button className="primary-button reset-button" onClick={onReset} disabled={recovering}>
            <span>↻</span> {recovering ? "WAIT FOR SAFE HOLD" : "RESET SYSTEM"}
          </button>
        )}
      </section>
    </main>
  );
}
