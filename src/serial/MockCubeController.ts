import { showConfig } from "../config/showConfig";
import { operationCommand, type CubeOperation } from "../operations/CubeOperation";
import type { CubeController, CubeControllerStatus } from "./CubeController";

type MockTransaction = "startDemo" | "operation" | "endDemo";

interface PendingMock {
  kind: MockTransaction;
  reject: (error: Error) => void;
}

export class MockCubeController implements CubeController {
  private connected = true;
  private status: CubeControllerStatus = "idle";
  private pending: PendingMock | null = null;
  private operationStartCallback = (_operation: CubeOperation) => {};
  private errorCallback = (_error: Error) => {};
  private timers = new Set<number>();

  async connect() {
    this.connected = true;
    console.info(`[SERIAL] < ${this.status.toUpperCase()} (mock)`);
  }

  async disconnect() {
    this.cancelPending(new Error("SERIAL CONNECTION CLOSED"));
    this.connected = false;
  }

  isConnected() { return this.connected; }
  isBusy() { return this.pending !== null; }

  async startDemo() {
    this.requireStatus("idle");
    await this.runTransaction("startDemo", "DEMO_START", undefined, showConfig.mock.startDemoDurationMs, "ready");
  }

  async executeOperation(operation: CubeOperation) {
    this.requireStatus("ready");
    const duration = this.operationDuration(operation);
    await this.runTransaction("operation", operationCommand(operation), operation, duration, "ready");
  }

  async endDemo() {
    this.requireStatus("ready");
    await this.runTransaction("endDemo", "DEMO_END", undefined, showConfig.mock.endDemoDurationMs, "idle");
  }

  async stop() {
    if (!this.connected) return;
    console.info("[SERIAL] > STOP");
    const interrupted = this.pending?.kind;
    this.cancelPending(new Error("OPERATION STOPPED"));
    if (interrupted === "endDemo") this.status = "idle";
    else if (interrupted === "startDemo" || interrupted === "operation") this.status = "ready";
    console.info(`[SERIAL] < ${this.status.toUpperCase()} (mock)`);
  }

  async getStatus() {
    this.requireConnected();
    console.info("[SERIAL] > STATUS");
    const status: CubeControllerStatus = this.pending ? "busy" : this.status;
    console.info(`[SERIAL] < ${status.toUpperCase()} (mock)`);
    return status;
  }

  onOperationStart(callback: (operation: CubeOperation) => void) {
    this.operationStartCallback = callback;
  }

  onError(callback: (error: Error) => void) {
    this.errorCallback = callback;
  }

  private runTransaction(
    kind: MockTransaction,
    command: string,
    operation: CubeOperation | undefined,
    durationMs: number,
    finalStatus: "idle" | "ready",
  ) {
    this.requireConnected();
    if (this.pending) return Promise.reject(new Error("CONTROLLER BUSY"));
    console.info(`[SERIAL] > ${command}`);
    this.status = "busy";

    return new Promise<void>((resolve, reject) => {
      this.pending = { kind, reject };
      this.schedule(() => {
        console.info(`[SERIAL] < ${this.startMessage(kind, operation)}`);
        if (operation) this.operationStartCallback(operation);
      }, showConfig.mock.startDelayMs);
      this.schedule(() => {
        console.info(`[SERIAL] < ${this.doneMessage(kind, operation)}`);
        this.pending = null;
        this.status = finalStatus;
        console.info(`[SERIAL] < ${finalStatus.toUpperCase()} (mock)`);
        resolve();
      }, showConfig.mock.startDelayMs + durationMs);
    });
  }

  private startMessage(kind: MockTransaction, operation?: CubeOperation) {
    if (kind === "startDemo") return "DEMO_START_START";
    if (kind === "endDemo") return "DEMO_END_START";
    if (operation?.type === "faceTurn" || operation?.type === "faceHesitation") {
      return `MOVE_START ${operation.face}`;
    }
    if (operation?.type === "thinking") return "THINK_START";
    return `ROTATE_START ${operation?.axis}`;
  }

  private doneMessage(kind: MockTransaction, operation?: CubeOperation) {
    if (kind === "startDemo") return "DEMO_START_DONE";
    if (kind === "endDemo") return "DEMO_END_DONE";
    if (operation?.type === "faceTurn" || operation?.type === "faceHesitation") {
      return `MOVE_DONE ${operation.face}`;
    }
    if (operation?.type === "thinking") return "THINK_DONE";
    return `ROTATE_DONE ${operation?.axis}`;
  }

  private operationDuration(operation: CubeOperation) {
    if (operation.type === "wholeRotation") return showConfig.mock.wholeRotationDurationMs;
    if (operation.type === "faceHesitation") return showConfig.mock.faceHesitationDurationMs;
    if (operation.type === "thinking") return showConfig.mock.thinkingDurationMs;
    return showConfig.mock.faceTurnDurationMs;
  }

  private schedule(callback: () => void, delayMs: number) {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delayMs);
    this.timers.add(timer);
  }

  private cancelPending(error: Error) {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    const pending = this.pending;
    this.pending = null;
    pending?.reject(error);
  }

  private requireConnected() {
    if (!this.connected) throw new Error("SERIAL CONNECTION LOST");
  }

  private requireStatus(expected: CubeControllerStatus) {
    this.requireConnected();
    if (this.pending) throw new Error("CONTROLLER BUSY");
    if (this.status !== expected) throw new Error("INVALID CONTROLLER STATE");
  }
}
