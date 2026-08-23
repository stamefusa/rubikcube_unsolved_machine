import type { CubeMove } from "../cube/CubeMove";
import type { CubeController } from "./CubeController";
import { parseSerialLine } from "./serialParser";

export class WebSerialCubeController implements CubeController {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private connected = false;
  private intentionalClose = false;
  private startCallback = (_move: CubeMove) => {};
  private doneCallback = (_move: CubeMove) => {};
  private errorCallback = (_error: Error) => {};
  private disconnectHandler = () => this.fail(new Error("SERIAL CONNECTION LOST"));

  async connect() {
    if (!navigator.serial) throw new Error("WEB SERIAL API NOT SUPPORTED");
    this.intentionalClose = false;
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: 115200 });
    if (!this.port.writable || !this.port.readable) throw new Error("SERIAL STREAM UNAVAILABLE");
    this.writer = this.port.writable.getWriter();
    this.connected = true;
    navigator.serial.addEventListener("disconnect", this.disconnectHandler);
    void this.readLoop();
    await this.write("PING");
  }

  async disconnect() {
    this.intentionalClose = true;
    this.connected = false;
    navigator.serial?.removeEventListener("disconnect", this.disconnectHandler);
    try { await this.reader?.cancel(); } catch { /* already closed */ }
    this.reader?.releaseLock(); this.reader = null;
    this.writer?.releaseLock(); this.writer = null;
    try { await this.port?.close(); } catch { /* device may be gone */ }
    this.port = null;
  }

  isConnected() { return this.connected; }
  async sendMove(move: CubeMove) { await this.write(`MOVE ${move.face} ${move.direction}`); }
  async stop() { if (this.connected) await this.write("STOP"); }
  onMoveStart(callback: (move: CubeMove) => void) { this.startCallback = callback; }
  onMoveDone(callback: (move: CubeMove) => void) { this.doneCallback = callback; }
  onError(callback: (error: Error) => void) { this.errorCallback = callback; }

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
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        lines.forEach((line) => this.handleLine(line));
      }
      if (!this.intentionalClose && this.connected) this.fail(new Error("SERIAL CONNECTION LOST"));
    } catch (error) {
      if (!this.intentionalClose) this.fail(error instanceof Error ? error : new Error(String(error)));
    } finally {
      try { this.reader?.releaseLock(); } catch { /* ignored */ }
      this.reader = null;
    }
  }

  private handleLine(line: string) {
    if (!line.trim()) return;
    console.info(`[SERIAL] < ${line.trim()}`);
    const message = parseSerialLine(line);
    if (message.type === "MOVE_START") this.startCallback(message.move);
    else if (message.type === "MOVE_DONE") this.doneCallback(message.move);
    else if (message.type === "ERROR") this.fail(new Error(message.message || "ARDUINO ERROR"));
  }

  private fail(error: Error) { this.connected = false; this.errorCallback(error); }
}
