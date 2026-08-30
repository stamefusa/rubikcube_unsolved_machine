import { ConnectionStatus } from "./ConnectionStatus";
import type { ShowState } from "../show/showState";

interface Props {
  state: ShowState;
  connected: boolean;
  mockMode: boolean;
  error: string | null;
  onConnect: () => void;
  onStartDemo: () => void;
  onAnalyze: () => void;
}

export function StandbyScreen({ state, connected, mockMode, error, onConnect, onStartDemo, onAnalyze }: Props) {
  const deviceConnected = connected || mockMode;
  const action = !deviceConnected
    ? { number: "01", label: "CONNECT DEVICE", onClick: onConnect, disabled: false }
    : state === "preDemo"
      ? { number: "02", label: "START DEMO", onClick: onStartDemo, disabled: false }
      : state === "startingDemo"
        ? { number: "02", label: "ENGAGING CUBE", onClick: onStartDemo, disabled: true }
        : { number: "03", label: "INITIATE ANALYSIS", onClick: onAnalyze, disabled: false };
  return (
    <main className="screen standby-screen">
      <div className="corner-mark top-left" /><div className="corner-mark bottom-right" />
      <div className="standby-orbit" aria-hidden="true"><span /><span /><span /></div>
      <section className="standby-content">
        <div className="eyebrow">AUTONOMOUS MANIPULATION UNIT // 01</div>
        <h1>RUBIK'S<br /><strong>CUBE</strong></h1>
        <p className="system-title">ADVANCED SOLVING SYSTEM</p>
        <div className="standby-divider"><span /></div>
        <ConnectionStatus connected={connected} mockMode={mockMode} />
        {error && <div className="system-error" role="alert">{error}</div>}
        <button
          className={`primary-button ${deviceConnected ? "armed" : ""}`}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          <span>{action.number}</span> {action.label}
        </button>
        <div className="microcopy">PROTOCOL: {mockMode ? "VIRTUAL / MOCK" : "SERIAL / 115200"} · CORE BUILD 26.8</div>
      </section>
    </main>
  );
}
