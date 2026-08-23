import { AudioManager } from "../audio/AudioManager";
import { showConfig } from "../config/showConfig";
import type { CubeMove } from "../cube/CubeMove";
import { MoveGenerator } from "../cube/MoveGenerator";
import type { CubeController } from "../serial/CubeController";
import type { ShowSnapshot, ShowState } from "./showState";

export class ShowController {
  private snapshot: ShowSnapshot = { state: "standby", connected: false, estimatedMoves: 18, moveCount: 0, currentMove: null, error: null };
  private listeners = new Set<() => void>();
  private analyzerTimer: number | null = null;
  private moveTimer: number | null = null;
  private session = 0;

  constructor(private cube: CubeController, private moves: MoveGenerator, private audio: AudioManager, private mockMode: boolean) {
    cube.onMoveDone((move) => this.handleMoveDone(move));
    cube.onError((error) => void this.handleError(error));
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  async connect() {
    try { await this.cube.connect(); this.patch({ connected: true, error: null }); }
    catch (error) { this.patch({ error: this.message(error), connected: false }); }
  }

  async disconnect() { await this.cube.disconnect(); this.patch({ connected: false }); }

  analyze() {
    if (!this.mockMode && !this.cube.isConnected()) return;
    this.clearTimers();
    const estimatedMoves = Math.floor(Math.random() * (showConfig.estimatedMoves.max - showConfig.estimatedMoves.min + 1)) + showConfig.estimatedMoves.min;
    this.patch({ state: "analyzing", estimatedMoves, moveCount: 0, currentMove: null, error: null });
    this.analyzerTimer = window.setTimeout(() => this.setState("analysisComplete"), showConfig.analyzerDurationMs);
  }

  async execute() {
    if (this.snapshot.state !== "analysisComplete") return;
    if (!this.cube.isConnected()) {
      if (this.mockMode) await this.cube.connect();
      else return void this.handleError(new Error("SERIAL CONNECTION LOST"));
    }
    this.session += 1;
    this.setState("executing");
    await this.sendNext(this.session);
  }

  async reset() {
    this.session += 1; this.clearTimers(); this.audio.stop(); this.moves.reset();
    try { await this.cube.stop(); } catch { /* reset should always remain available */ }
    this.patch({ state: "standby", moveCount: 0, currentMove: null, error: null, connected: this.cube.isConnected() });
  }

  dispose() { this.session += 1; this.clearTimers(); this.audio.stop(); }

  private async sendNext(run: number) {
    if (run !== this.session || this.snapshot.moveCount >= showConfig.maxMoves) return void this.giveUp();
    const move = this.moves.next();
    const nextCount = this.snapshot.moveCount + 1;
    let state: ShowState = "executing";
    if (nextCount >= showConfig.phases.desperateStart) state = "desperate";
    else if (nextCount >= showConfig.phases.confusedStart) state = "confused";
    this.patch({ state, currentMove: move, moveCount: nextCount });
    console.info(`[MOVE] count=${nextCount}`);
    this.audio.maybePlay(nextCount);
    try {
      await this.cube.sendMove(move);
      this.moveTimer = window.setTimeout(() => void this.handleError(new Error("MOTOR RESPONSE TIMEOUT")), showConfig.moveTimeoutMs);
    } catch (error) { await this.handleError(error instanceof Error ? error : new Error(String(error))); }
  }

  private handleMoveDone(received: CubeMove) {
    const expected = this.snapshot.currentMove;
    if (!expected || received.face !== expected.face || received.direction !== expected.direction) return;
    if (this.moveTimer) clearTimeout(this.moveTimer);
    this.moveTimer = null;
    if (this.snapshot.moveCount >= showConfig.maxMoves) void this.giveUp();
    else void this.sendNext(this.session);
  }

  private async giveUp() {
    this.clearTimers(); this.setState("giveUp");
    await this.cube.stop().catch(() => undefined);
    await this.audio.play("murida");
  }

  private async handleError(error: Error) {
    this.session += 1; this.clearTimers();
    try { await this.cube.stop(); } catch { /* connection may already be gone */ }
    this.patch({ state: "giveUp", error: this.message(error), connected: this.cube.isConnected() });
  }

  private setState(state: ShowState) { this.patch({ state }); }
  private patch(next: Partial<ShowSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    if (next.state) console.info(`[SHOW] state=${next.state}`);
    this.listeners.forEach((listener) => listener());
  }
  private clearTimers() { if (this.analyzerTimer) clearTimeout(this.analyzerTimer); if (this.moveTimer) clearTimeout(this.moveTimer); this.analyzerTimer = this.moveTimer = null; }
  private message(error: unknown) { return error instanceof Error ? error.message.toUpperCase() : String(error).toUpperCase(); }
}
