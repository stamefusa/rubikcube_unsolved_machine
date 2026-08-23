export const showConfig = {
  analyzerDurationMs: 7000,
  estimatedMoves: { min: 15, max: 25 },
  maxMoves: 35,
  phases: { confusedStart: 7, troubledStart: 15, desperateStart: 25 },
  moveTimeoutMs: 5000,
  mock: { startDelayMs: 280, doneDelayMs: 720 },
  audioProbability: { executing: 0, confused: 0.15, troubled: 0.25, desperate: 0.4 },
} as const;
