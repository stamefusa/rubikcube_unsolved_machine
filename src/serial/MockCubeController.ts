import type { CubeMove } from "../cube/CubeMove";
import { showConfig } from "../config/showConfig";
import type { CubeController } from "./CubeController";

export class MockCubeController implements CubeController {
  private connected = false;
  private startCallback = (_move: CubeMove) => {};
  private doneCallback = (_move: CubeMove) => {};
  private errorCallback = (_error: Error) => {};
  private timers = new Set<number>();

  async connect() { this.connected = true; console.info("[SERIAL] < READY (mock)"); }
  async disconnect() { this.clearTimers(); this.connected = false; }
  isConnected() { return this.connected; }

  async sendMove(move: CubeMove) {
    if (!this.connected) await this.connect();
    console.info(`[SERIAL] > MOVE ${move.face} ${move.direction}`);
    const startTimer = window.setTimeout(() => {
      console.info(`[SERIAL] < MOVE_START ${move.face} ${move.direction}`);
      this.startCallback(move);
    }, showConfig.mock.startDelayMs);
    const doneTimer = window.setTimeout(() => {
      console.info(`[SERIAL] < MOVE_DONE ${move.face} ${move.direction}`);
      this.doneCallback(move);
      this.timers.delete(startTimer); this.timers.delete(doneTimer);
    }, showConfig.mock.startDelayMs + showConfig.mock.doneDelayMs);
    this.timers.add(startTimer); this.timers.add(doneTimer);
  }

  async stop() { console.info("[SERIAL] > STOP"); this.clearTimers(); }
  onMoveStart(callback: (move: CubeMove) => void) { this.startCallback = callback; }
  onMoveDone(callback: (move: CubeMove) => void) { this.doneCallback = callback; }
  onError(callback: (error: Error) => void) { this.errorCallback = callback; }
  private clearTimers() { this.timers.forEach(clearTimeout); this.timers.clear(); }
}
