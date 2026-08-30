import type { CubeOperation } from "../operations/CubeOperation";

export type CubeControllerStatus = "idle" | "ready" | "busy" | "error";

export interface CubeController {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  isBusy(): boolean;
  startDemo(): Promise<void>;
  executeOperation(operation: CubeOperation): Promise<void>;
  endDemo(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<CubeControllerStatus>;
  onOperationStart(callback: (operation: CubeOperation) => void): void;
  onError(callback: (error: Error) => void): void;
}
