import type { CubeMove } from "../cube/CubeMove";

export interface CubeController {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  sendMove(move: CubeMove): Promise<void>;
  stop(): Promise<void>;
  onMoveStart(callback: (move: CubeMove) => void): void;
  onMoveDone(callback: (move: CubeMove) => void): void;
  onError(callback: (error: Error) => void): void;
}
