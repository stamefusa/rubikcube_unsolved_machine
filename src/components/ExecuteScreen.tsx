import { ProgressBar } from "./ProgressBar";
import type { ShowState } from "../show/showState";
import { showConfig } from "../config/showConfig";

interface Props { state: ShowState; moveCount: number; estimatedMoves: number }

function statusFor(state: ShowState, moveCount: number, estimated: number) {
  if (state === "desperate") return moveCount > 30 ? "RECOVERY ATTEMPT" : "SOLUTION DEVIATION DETECTED";
  if (state === "confused") return moveCount > estimated ? "RECALCULATING OPTIMAL PATH" : "ADAPTIVE PATH CORRECTION";
  return "EXECUTING OPTIMAL SOLUTION";
}

export function ExecuteScreen({ state, moveCount, estimatedMoves }: Props) {
  const overflow = moveCount > estimatedMoves;
  const percent = (moveCount / estimatedMoves) * 100;
  const history = ["R", "U′", "F", "L′", "D", "B′"].slice(0, Math.min(6, moveCount));
  return (
    <main className={`screen execute-screen ${state} ${overflow ? "is-overflow" : ""}`}>
      <header className="app-header"><div><b>CUBE://ACTUATOR</b><span>MOTION CONTROL</span></div><div className="header-status"><i />LIVE EXECUTION</div></header>
      <section className="execution-shell">
        <div className="execution-status"><span>PROTOCOL STATUS</span><h2>{statusFor(state, moveCount, estimatedMoves)}</h2></div>
        <div className="deviation-slot">
          {overflow && <div className="deviation-banner" role="alert"><i>!</i> NOMINAL MOVE ENVELOPE EXCEEDED <b>+{moveCount - estimatedMoves}</b></div>}
        </div>
        <div className="execution-grid">
          <section className="hud-panel move-sequence">
            <header>SEQUENCE MONITOR <i>ACTIVE</i></header>
            <div className="sequence-layout">
              <div className="move-counter"><span>MOVE</span><b>{String(moveCount).padStart(2, "0")}</b><em>/ {estimatedMoves}</em></div>
              <div className="sequence-history"><small>RECENT VECTOR</small><div>{history.map((item, i) => <span key={i}>{item}</span>)}</div></div>
              <div className="motor-lines"><p><span>AXIS SERVO</span><b>LOCKED</b></p><p><span>TORQUE LIMIT</span><b>84.2%</b></p><p><span>FEEDBACK</span><b>NOMINAL</b></p></div>
            </div>
          </section>
          <section className="hud-panel solution-progress">
            <header>SOLUTION PROGRESS <i>{overflow ? "OVERRUN" : "SYNC"}</i></header>
            <div className="progress-layout">
              <div className="progress-number">{Math.round(percent)}<small>%</small><span>{overflow ? `+${moveCount - estimatedMoves} MOVES` : "NOMINAL PATH"}</span></div>
              <div className="progress-main"><ProgressBar value={percent} overflow={overflow} overflowMultiplier={showConfig.progressOverflowMultiplier} /></div>
              <div className="diagnostic-list">
                <p><i /> POSITION VECTOR <b>VERIFIED</b></p><p><i /> PATH COHERENCE <b>{overflow ? "UNSTABLE" : "99.9%"}</b></p>
                <p><i /> ERROR CORRECTION <b>{state === "executing" ? "STANDBY" : "ACTIVE"}</b></p>
              </div>
            </div>
          </section>
        </div>
      </section>
      <div className="execute-ticker"><span>ACTUATOR BUS 06 ONLINE</span><span>REAL-TIME KINEMATICS</span><span>DO NOT INTERRUPT</span></div>
    </main>
  );
}
