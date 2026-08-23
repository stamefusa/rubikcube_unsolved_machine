interface Props { logs: string[] }

export function FakeTerminal({ logs }: Props) {
  return (
    <section className="hud-panel terminal-panel">
      <header><span>SYS://ANALYSIS_STREAM</span><i>LIVE</i></header>
      <div className="terminal-lines">
        {logs.map((line, index) => <div key={`${index}-${line}`}><b>›</b> {line}</div>)}
      </div>
    </section>
  );
}
