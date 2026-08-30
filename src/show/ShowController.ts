import { AudioManager } from "../audio/AudioManager";
import { showConfig } from "../config/showConfig";
import { formatOperation } from "../operations/CubeOperation";
import { OperationGenerator } from "../operations/OperationGenerator";
import type { CubeController, CubeControllerStatus } from "../serial/CubeController";
import type { ShowSnapshot, ShowState } from "./showState";

export class ShowController {
  private snapshot: ShowSnapshot;
  private listeners = new Set<() => void>();
  private analyzerTimer: number | null = null;
  private session = 0;
  private handlingError = false;
  private connecting = false;

  constructor(
    private cube: CubeController,
    private operations: Pick<OperationGenerator, "nextOperation" | "reset">,
    private audio: Pick<AudioManager, "maybePlay" | "play" | "stop">,
  ) {
    this.snapshot = {
      state: "preDemo",
      connected: cube.isConnected(),
      estimatedMoves: 18,
      moveCount: 0,
      currentOperation: null,
      error: null,
      recovering: false,
    };
    cube.onOperationStart((operation) => {
      console.info(`[OPERATION] started ${operation.type} ${formatOperation(operation)}`);
    });
    cube.onError((error) => void this.handleError(error));
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async connect() {
    if (this.connecting || this.cube.isConnected()) return;
    this.connecting = true;
    try {
      await this.cube.connect();
      const status = await this.cube.getStatus();
      this.patch({
        state: this.stateForStatus(status),
        connected: true,
        error: null,
        recovering: false,
      });
    } catch (error) {
      if (this.cube.isConnected()) await this.handleError(this.asError(error));
      else this.patch({ error: this.message(error), connected: false, state: "preDemo" });
    } finally {
      this.connecting = false;
    }
  }

  async disconnect() {
    this.session += 1;
    this.clearTimers();
    this.audio.stop();
    await this.cube.disconnect();
    this.patch({ state: "preDemo", connected: false, currentOperation: null, recovering: false });
  }

  async startDemo() {
    if (this.snapshot.state !== "preDemo" || !this.cube.isConnected()) return;
    const run = ++this.session;
    this.operations.reset();
    this.patch({
      state: "startingDemo",
      moveCount: 0,
      currentOperation: null,
      error: null,
      recovering: false,
    });
    try {
      await this.cube.startDemo();
      if (run !== this.session) return;
      this.setState("standby");
    } catch (error) {
      if (run === this.session) await this.handleError(this.asError(error));
    }
  }

  analyze() {
    if (this.snapshot.state !== "standby" || !this.cube.isConnected()) return;
    this.clearTimers();
    const estimatedMoves = Math.floor(
      Math.random() * (showConfig.estimatedMoves.max - showConfig.estimatedMoves.min + 1),
    ) + showConfig.estimatedMoves.min;
    this.patch({
      state: "analyzing",
      estimatedMoves,
      moveCount: 0,
      currentOperation: null,
      error: null,
      recovering: false,
    });
    this.analyzerTimer = window.setTimeout(
      () => this.setState("analysisComplete"),
      showConfig.analyzerDurationMs,
    );
  }

  async execute() {
    if (this.snapshot.state !== "analysisComplete") return;
    if (!this.cube.isConnected()) {
      await this.handleError(new Error("SERIAL CONNECTION LOST"));
      return;
    }
    const run = ++this.session;
    this.setState("executing");
    await this.runOperations(run);
  }

  async reset() {
    if (this.handlingError) return;
    this.session += 1;
    this.clearTimers();
    this.audio.stop();
    this.operations.reset();

    if (!this.cube.isConnected()) {
      this.patch({
        state: "preDemo",
        connected: false,
        moveCount: 0,
        currentOperation: null,
        error: null,
        recovering: false,
      });
      return;
    }

    try {
      await this.cube.stop();
      const status = await this.cube.getStatus();
      this.patch({
        state: this.stateForStatus(status),
        connected: this.cube.isConnected(),
        moveCount: 0,
        currentOperation: null,
        error: null,
        recovering: false,
      });
    } catch (error) {
      this.patch({ state: "error", error: this.message(error), connected: this.cube.isConnected(), recovering: false });
    }
  }

  dispose() {
    this.session += 1;
    this.clearTimers();
    this.audio.stop();
  }

  private async runOperations(run: number) {
    while (run === this.session && this.snapshot.moveCount < showConfig.maxOperations) {
      const operation = this.operations.nextOperation();
      const operationNumber = this.snapshot.moveCount + 1;
      this.patch({
        state: this.phaseFor(operationNumber),
        currentOperation: operation,
      });
      console.info(`[OPERATION] ${operation.type} ${formatOperation(operation)}`);

      try {
        await this.cube.executeOperation(operation);
      } catch (error) {
        if (run === this.session) await this.handleError(this.asError(error));
        return;
      }
      if (run !== this.session) return;

      this.patch({ moveCount: operationNumber });
      console.info(`[OPERATION] completed count=${operationNumber}`);
      this.audio.maybePlay(operationNumber);
    }

    if (run === this.session) await this.giveUp(run);
  }

  private async giveUp(run: number) {
    this.clearTimers();
    this.patch({ state: "giveUp", currentOperation: null });
    this.audio.stop();
    await this.audio.play("murida");
    if (run !== this.session) return;

    this.setState("endingDemo");
    try {
      await this.cube.endDemo();
      if (run !== this.session) return;
      this.operations.reset();
      this.patch({
        state: "preDemo",
        moveCount: 0,
        currentOperation: null,
        error: null,
        connected: this.cube.isConnected(),
        recovering: false,
      });
    } catch (error) {
      if (run === this.session) await this.handleError(this.asError(error));
    }
  }

  private async handleError(error: Error) {
    if (this.handlingError) return;
    this.handlingError = true;
    this.session += 1;
    this.clearTimers();
    this.audio.stop();
    let errorMessage = this.message(error);
    this.patch({ state: "error", error: errorMessage, connected: this.cube.isConnected(), recovering: true });

    if (this.cube.isConnected()) {
      try {
        await this.cube.stop();
      } catch (stopError) {
        errorMessage = `${errorMessage} / ${this.message(stopError)}`;
      }
    }
    this.patch({ state: "error", error: errorMessage, connected: this.cube.isConnected(), recovering: false });
    this.handlingError = false;
  }

  private stateForStatus(status: CubeControllerStatus): ShowState {
    if (status === "idle") return "preDemo";
    if (status === "ready") return "standby";
    throw new Error(status === "busy" ? "ARDUINO BUSY" : "ARDUINO ERROR STATE");
  }

  private phaseFor(operationNumber: number): ShowState {
    if (operationNumber >= showConfig.phases.desperateStart) return "desperate";
    if (operationNumber >= showConfig.phases.confusedStart) return "confused";
    return "executing";
  }

  private setState(state: ShowState) {
    this.patch({ state });
  }

  private patch(next: Partial<ShowSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    if (next.state) console.info(`[SHOW] state=${next.state}`);
    this.listeners.forEach((listener) => listener());
  }

  private clearTimers() {
    if (this.analyzerTimer) clearTimeout(this.analyzerTimer);
    this.analyzerTimer = null;
  }

  private message(error: unknown) {
    return this.asError(error).message.toUpperCase();
  }

  private asError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
