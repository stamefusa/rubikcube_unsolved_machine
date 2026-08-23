interface Props { connected: boolean; mockMode: boolean }

export function ConnectionStatus({ connected, mockMode }: Props) {
  return (
    <div className={`connection ${connected || mockMode ? "online" : "offline"}`}>
      <span className="status-dot" />
      <span>{mockMode ? "SIMULATION LINK" : connected ? "SERIAL LINK ONLINE" : "SERIAL LINK OFFLINE"}</span>
    </div>
  );
}
