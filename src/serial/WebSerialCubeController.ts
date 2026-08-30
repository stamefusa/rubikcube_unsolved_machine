import { showConfig } from "../config/showConfig";
import {
  operationCommand,
  operationsEqual,
  type CubeOperation,
} from "../operations/CubeOperation";
import type { CubeController, CubeControllerStatus } from "./CubeController";
import { parseSerialLine, type SerialMessage } from "./serialParser";

type PendingKind = "handshake" | "startDemo" | "operation" | "endDemo" | "status" | "stop";

interface PendingRequest {
  kind: PendingKind;
  expectedOperation?: CubeOperation;
  resolve: (status: CubeControllerStatus) => void;
  reject: (error: Error) => void;
  timeoutId: number;
  retryId: number | null;
}

export class WebSerialCubeController implements CubeController {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private connected = false;
  private intentionalClose = false;
  private status: CubeControllerStatus = "idle";
  private pending: PendingRequest | null = null;
  private operationStartCallback = (_operation: CubeOperation) => {};
  private errorCallback = (_error: Error) => {};
  private disconnectHandler = () => this.fail(new Error("SERIAL CONNECTION LOST"));

  async connect() {
    if (this.connected) return;
    if (!navigator.serial) throw new Error("WEB SERIAL API NOT SUPPORTED");

    this.intentionalClose = false;
    this.port = await navigator.serial.requestPort();
    try {
      await this.port.open({ baudRate: 115200 });
      if (!this.port.writable || !this.port.readable) throw new Error("SERIAL STREAM UNAVAILABLE");
      this.writer = this.port.writable.getWriter();
      this.connected = true;
      navigator.serial.addEventListener("disconnect", this.disconnectHandler);
      void this.readLoop();
      await this.request(
        "handshake",
        "PING",
        showConfig.connectionTimeoutMs,
        undefined,
        showConfig.pingRetryMs,
      );
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async disconnect() {
    this.intentionalClose = true;
    this.connected = false;
    navigator.serial?.removeEventListener("disconnect", this.disconnectHandler);
    this.rejectPending(new Error("SERIAL CONNECTION CLOSED"));
    try { await this.reader?.cancel(); } catch { /* already closed */ }
    try { this.reader?.releaseLock(); } catch { /* already released */ }
    this.reader = null;
    try { this.writer?.releaseLock(); } catch { /* already released */ }
    this.writer = null;
    try { await this.port?.close(); } catch { /* device may be gone */ }
    this.port = null;
  }

  isConnected() { return this.connected; }
  isBusy() { return this.pending !== null; }

  async startDemo() {
    await this.request("startDemo", "DEMO_START", showConfig.operationTimeoutMs);
  }

  async executeOperation(operation: CubeOperation) {
    await this.request("operation", operationCommand(operation), showConfig.operationTimeoutMs, operation);
  }

  async endDemo() {
    await this.request("endDemo", "DEMO_END", showConfig.operationTimeoutMs);
  }

  async stop() {
    if (!this.connected) return;
    if (this.pending?.kind === "stop") throw new Error("STOP ALREADY IN PROGRESS");
    this.rejectPending(new Error("OPERATION STOPPED"));
    await this.request("stop", "STOP", showConfig.operationTimeoutMs);
  }

  async getStatus() {
    return this.request("status", "STATUS", showConfig.operationTimeoutMs);
  }

  onOperationStart(callback: (operation: CubeOperation) => void) {
    this.operationStartCallback = callback;
  }

  onError(callback: (error: Error) => void) {
    this.errorCallback = callback;
  }

  private request(
    kind: PendingKind,
    command: string,
    timeoutMs: number,
    expectedOperation?: CubeOperation,
    retryMs?: number,
  ): Promise<CubeControllerStatus> {
    if (!this.writer || !this.connected) return Promise.reject(new Error("SERIAL CONNECTION LOST"));
    if (this.pending) return Promise.reject(new Error("CONTROLLER BUSY"));

    return new Promise((resolve, reject) => {
      const pending: PendingRequest = {
        kind,
        expectedOperation,
        resolve,
        reject,
        timeoutId: 0,
        retryId: null,
      };
      pending.timeoutId = window.setTimeout(() => {
        if (this.pending !== pending) return;
        this.rejectPending(new Error(this.timeoutMessage(kind)));
      }, timeoutMs);
      this.pending = pending;

      const send = () => {
        void this.write(command).catch((error) => {
          if (this.pending === pending) this.rejectPending(this.asError(error));
        });
      };
      send();
      if (retryMs) pending.retryId = window.setInterval(send, retryMs);
    });
  }

  private async write(message: string) {
    if (!this.writer || !this.connected) throw new Error("SERIAL CONNECTION LOST");
    console.info(`[SERIAL] > ${message}`);
    await this.writer.write(new TextEncoder().encode(`${message}\n`));
  }

  private async readLoop() {
    if (!this.port?.readable) return;
    this.reader = this.port.readable.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (this.connected) {
        const { value, done } = await this.reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach((line) => this.handleLine(line));
      }
      if (!this.intentionalClose && this.connected) this.fail(new Error("SERIAL CONNECTION LOST"));
    } catch (error) {
      if (!this.intentionalClose) this.fail(this.asError(error));
    } finally {
      try { this.reader?.releaseLock(); } catch { /* ignored */ }
      this.reader = null;
    }
  }

  private handleLine(line: string) {
    if (!line.trim()) return;
    console.info(`[SERIAL] < ${line.trim()}`);
    const message = parseSerialLine(line);

    switch (message.type) {
      case "PONG":
        this.completeIf("handshake", this.status);
        break;
      case "IDLE":
        this.status = "idle";
        if (this.pending?.kind === "status" || this.pending?.kind === "stop") {
          this.completePending("idle");
        }
        break;
      case "READY":
        this.status = "ready";
        if (this.pending?.kind === "status" || this.pending?.kind === "stop") {
          this.completePending("ready");
        }
        break;
      case "BUSY":
        this.status = "busy";
        if (this.pending?.kind === "status") this.completePending("busy");
        else if (this.pending) this.rejectPending(new Error("ARDUINO BUSY"));
        break;
      case "DEMO_START_START":
      case "DEMO_END_START":
        break;
      case "DEMO_START_DONE":
        this.status = "ready";
        this.completeIf("startDemo", "ready", message);
        break;
      case "DEMO_END_DONE":
        this.status = "idle";
        this.completeIf("endDemo", "idle", message);
        break;
      case "MOVE_START":
      case "ROTATE_START":
        this.handleOperationStart(message.operation);
        break;
      case "MOVE_DONE":
      case "ROTATE_DONE":
        this.handleOperationDone(message.operation, message);
        break;
      case "ERROR": {
        this.status = "error";
        const error = new Error(`ARDUINO ERROR: ${message.code}`);
        if (this.pending?.kind === "status") this.completePending("error");
        else if (this.pending) this.rejectPending(error);
        else this.errorCallback(error);
        break;
      }
      case "UNKNOWN":
        console.warn(`[SERIAL] ignored unknown message: ${message.raw}`);
        break;
    }
  }

  private handleOperationStart(operation: CubeOperation) {
    const expected = this.pending?.expectedOperation;
    if (this.pending?.kind !== "operation" || !expected) return;
    if (!operationsEqual(expected, operation)) {
      this.rejectPending(new Error("OPERATION START MISMATCH"));
      return;
    }
    this.operationStartCallback(operation);
  }

  private handleOperationDone(operation: CubeOperation, message: SerialMessage) {
    const expected = this.pending?.expectedOperation;
    if (this.pending?.kind !== "operation" || !expected) return;
    if (!operationsEqual(expected, operation)) {
      this.rejectPending(new Error("OPERATION DONE MISMATCH"));
      return;
    }
    this.status = "ready";
    this.completeIf("operation", "ready", message);
  }

  private completeIf(kind: PendingKind, status: CubeControllerStatus, message?: SerialMessage) {
    if (!this.pending) return;
    if (this.pending.kind !== kind) {
      if (message) this.rejectPending(new Error(`UNEXPECTED ${message.type}`));
      return;
    }
    this.completePending(status);
  }

  private completePending(status: CubeControllerStatus) {
    const pending = this.takePending();
    pending?.resolve(status);
  }

  private rejectPending(error: Error) {
    const pending = this.takePending();
    pending?.reject(error);
  }

  private takePending() {
    const pending = this.pending;
    if (!pending) return null;
    clearTimeout(pending.timeoutId);
    if (pending.retryId !== null) clearInterval(pending.retryId);
    this.pending = null;
    return pending;
  }

  private fail(error: Error) {
    if (this.intentionalClose) return;
    this.connected = false;
    this.rejectPending(error);
    this.errorCallback(error);
  }

  private timeoutMessage(kind: PendingKind) {
    if (kind === "handshake") return "SERIAL HANDSHAKE TIMEOUT";
    if (kind === "status") return "STATUS RESPONSE TIMEOUT";
    if (kind === "stop") return "STOP RESPONSE TIMEOUT";
    return "MACHINE RESPONSE TIMEOUT";
  }

  private asError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
