import type { ShowState } from "../show/showState";

interface Props {
  state: ShowState;
  error: string | null;
  moveCount: number;
  recovering: boolean;
  onReset: () => void;
  onReturnToStart: () => void;
}

export function GiveUpScreen({ state, error, moveCount, recovering, onReset, onReturnToStart }: Props) {
  const ending = state === "endingDemo";
  const released = state === "releaseComplete";
  return (
    <main className="screen giveup-screen">
      <div className="failure-noise" />
      <section className="failure-card">
        <div className="failure-icon">!</div>
        <span className="failure-label">SOLVING STATUS</span>
        <h2>{error ? "SYSTEM HALT" : ending ? "RELEASING" : "FAILED"}</h2>
        <p>{error ?? (ending
          ? "CUBE RELEASE SEQUENCE ACTIVE"
          : released ? "CUBE RELEASED / DEMO COMPLETE" : "SOLUTION COULD NOT BE COMPLETED")}</p>
        <div className="failure-stats"><span>ATTEMPTED MOVES</span><b>{String(moveCount).padStart(2, "0")}</b><span>CONFIDENCE</span><b>0.00%</b></div>
        {state === "error" && (
          <button className="primary-button reset-button" onClick={onReset} disabled={recovering}>
            <span>↻</span> {recovering ? "WAIT FOR SAFE HOLD" : "RESET SYSTEM"}
          </button>
        )}
        {released && (
          <button className="primary-button reset-button" onClick={onReturnToStart}>
            <span>↻</span> RETURN TO DEMO START
          </button>
        )}
      </section>
    </main>
  );
}
