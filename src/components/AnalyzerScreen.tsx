import { useEffect, useState } from "react";
import { createAnalyzerFrame, type AnalyzerFrame } from "../analyzer/fakeAnalyzer";
import { showConfig } from "../config/showConfig";
import { FakeTerminal } from "./FakeTerminal";
import { ProgressBar } from "./ProgressBar";
import { WireCube } from "./WireCube";

const initial = createAnalyzerFrame(0, showConfig.analyzerDurationMs);

export function AnalyzerScreen() {
  const [frame, setFrame] = useState<AnalyzerFrame>(initial);
  const [logs, setLogs] = useState<string[]>([initial.log]);

  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => {
      const next = createAnalyzerFrame(performance.now() - start, showConfig.analyzerDurationMs);
      setFrame(next); setLogs((old) => [...old.slice(-10), next.log]);
    }, 90);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="screen analyzer-screen">
      <header className="app-header"><div><b>CUBE://CORE</b><span>ANALYTIC ENGINE</span></div><div className="header-status"><i />PROCESSING</div></header>
      <section className="analysis-title"><span>ACTIVE ROUTINE / 04-A</span><h2>{frame.stage}</h2><ProgressBar value={frame.progress * 100} /></section>
      <div className="analysis-grid">
        <section className="hud-panel metric-stack">
          <header>SEARCH TELEMETRY <i>01</i></header>
          <Metric label="SEARCH NODES" value={frame.nodes.toLocaleString()} />
          <Metric label="SEARCH DEPTH" value={String(frame.depth).padStart(2, "0")} suffix="LVL" />
          <Metric label="STATE COUNT" value={frame.stateCount.toLocaleString()} />
          <div className="mini-wave" aria-hidden="true">{Array.from({ length: 26 }, (_, i) => <i key={i} style={{ height: `${16 + ((frame.nodes + i * 37) % 72)}%` }} />)}</div>
        </section>
        <section className="center-analysis"><WireCube /></section>
        <section className="hud-panel metric-stack right-metrics">
          <header>SOLUTION VECTOR <i>02</i></header>
          <Metric label="CONFIDENCE" value={frame.confidence.toFixed(2)} suffix="%" accent />
          <Metric label="ENTROPY" value={frame.entropy.toFixed(4)} />
          <Metric label="OPTIMIZATION" value={frame.optimization.toFixed(2)} suffix="%" />
          <div className="coordinate"><span>CUBE COORDINATES</span><b>{frame.coordinate}</b></div>
          <div className="matrix"><span>MATRIX</span><b>{frame.matrix}</b></div>
        </section>
        <FakeTerminal logs={logs} />
        <section className="hud-panel graph-panel">
          <header>HEURISTIC CONVERGENCE <i>REALTIME</i></header>
          <svg viewBox="0 0 600 110" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,92 32,74 65,82 98,43 130,60 168,28 205,48 245,18 285,31 325,14 365,24 405,8 450,18 495,5 550,10 600,3" />
            <line x1="0" y1="90" x2="600" y2="90" /><line x1="0" y1="50" x2="600" y2="50" />
          </svg>
        </section>
      </div>
      <footer className="data-footer"><span>NO INPUT ANOMALIES</span><span>MEM 42.81 TB</span><span>THREADS 4096</span><span>SECURE CHANNEL</span></footer>
    </main>
  );
}

function Metric({ label, value, suffix, accent }: { label: string; value: string; suffix?: string; accent?: boolean }) {
  return <div className={`metric ${accent ? "accent" : ""}`}><span>{label}</span><b>{value}</b>{suffix && <small>{suffix}</small>}</div>;
}
