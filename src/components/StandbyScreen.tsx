import { ConnectionStatus } from "./ConnectionStatus";

interface Props { connected: boolean; mockMode: boolean; error: string | null; onConnect: () => void; onAnalyze: () => void }

export function StandbyScreen({ connected, mockMode, error, onConnect, onAnalyze }: Props) {
  const ready = connected || mockMode;
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
        {!ready ? (
          <button className="primary-button" onClick={onConnect}><span>01</span> CONNECT DEVICE</button>
        ) : (
          <button className="primary-button armed" onClick={onAnalyze}><span>02</span> INITIATE ANALYSIS</button>
        )}
        <div className="microcopy">PROTOCOL: {mockMode ? "VIRTUAL / MOCK" : "SERIAL / 115200"} · CORE BUILD 26.8</div>
      </section>
    </main>
  );
}
