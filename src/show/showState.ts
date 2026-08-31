import type { CubeOperation } from "../operations/CubeOperation";

export type ShowState =
  | "preDemo"
  | "startingDemo"
  | "standby"
  | "cancelingDemo"
  | "analyzing"
  | "analysisComplete"
  | "executing"
  | "confused"
  | "desperate"
  | "giveUp"
  | "endingDemo"
  | "error";

export interface ShowSnapshot {
  state: ShowState;
  connected: boolean;
  estimatedMoves: number;
  moveCount: number;
  currentOperation: CubeOperation | null;
  error: string | null;
  recovering: boolean;
}
