import { analyzerStages, logFragments } from "./fakeAnalyzerConfig";

export interface AnalyzerFrame {
  stage: string; progress: number; nodes: number; depth: number; confidence: number;
  entropy: number; optimization: number; stateCount: number; matrix: string; coordinate: string; log: string;
}

export function createAnalyzerFrame(elapsed: number, duration: number): AnalyzerFrame {
  const progress = Math.min(1, elapsed / duration);
  const index = Math.min(analyzerStages.length - 1, Math.floor(progress * analyzerStages.length));
  const now = new Date();
  const timestamp = now.toLocaleTimeString("en-GB", { hour12: false }) + `.${String(now.getMilliseconds()).padStart(3, "0")}`;
  const fragment = logFragments[Math.floor(Math.random() * logFragments.length)];
  const state = Math.floor(18000 + progress * 870000 + Math.random() * 900);
  return {
    stage: analyzerStages[index], progress, nodes: Math.floor(progress * 2480000 + Math.random() * 9800),
    depth: Math.min(22, Math.floor(3 + progress * 20)), confidence: 70 + progress * 30,
    entropy: Math.max(0.02, 8.42 * (1 - progress) + Math.random() * 0.3), optimization: 71 + progress * 28.8,
    stateCount: state, matrix: Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join(" "),
    coordinate: `${Math.floor(Math.random() * 999)}:${Math.floor(Math.random() * 999)}:${Math.floor(Math.random() * 999)}`,
    log: `[${timestamp}] ${fragment}${fragment === "Searching state" ? ` ${state}` : ""}`,
  };
}
