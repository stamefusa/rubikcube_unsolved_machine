import type { CubeMove } from "../cube/CubeMove";

export type ShowState = "standby" | "analyzing" | "analysisComplete" | "executing" | "confused" | "desperate" | "giveUp";

export interface ShowSnapshot {
  state: ShowState;
  connected: boolean;
  estimatedMoves: number;
  moveCount: number;
  currentMove: CubeMove | null;
  error: string | null;
}
