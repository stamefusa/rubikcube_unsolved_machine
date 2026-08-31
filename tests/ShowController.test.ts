import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showConfig } from "../src/config/showConfig";
import { operationCommand, type CubeOperation } from "../src/operations/CubeOperation";
import type { CubeController, CubeControllerStatus } from "../src/serial/CubeController";
import { ShowController } from "../src/show/ShowController";

class FakeCubeController implements CubeController {
  connected = true;
  status: CubeControllerStatus = "idle";
  operations: CubeOperation[] = [];
  commands: string[] = [];
  operationError: Error | null = null;
  endDemoWait: Promise<void> | null = null;
  private startCallback = (_operation: CubeOperation) => {};
  private errorCallback = (_error: Error) => {};

  async connect() { this.connected = true; }
  async disconnect() { this.connected = false; }
  isConnected() { return this.connected; }
  isBusy() { return false; }
  async startDemo() { this.commands.push("DEMO_START"); this.status = "ready"; }
  async executeOperation(operation: CubeOperation) {
    this.commands.push(operationCommand(operation));
    this.startCallback(operation);
    if (this.operationError) throw this.operationError;
    this.operations.push(operation);
  }
  async endDemo() {
    this.commands.push("DEMO_END");
    if (this.endDemoWait) await this.endDemoWait;
    this.status = "idle";
  }
  async stop() { this.commands.push("STOP"); }
  async getStatus() { return this.status; }
  onOperationStart(callback: (operation: CubeOperation) => void) { this.startCallback = callback; }
  onError(callback: (error: Error) => void) { this.errorCallback = callback; }
}

const generator = {
  nextOperation: (): CubeOperation => ({ type: "faceTurn", face: "R" }),
  reset: () => undefined,
};
const audio = {
  maybePlay: vi.fn(),
  playPhase: vi.fn(async () => undefined),
  resetPlaylist: vi.fn(),
  stop: vi.fn(),
};

describe("ShowController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal("window", globalThis);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not engage the cube before the explicit START DEMO action", async () => {
    const cube = new FakeCubeController();
    const show = new ShowController(cube, generator, audio);
    expect(show.getSnapshot().state).toBe("preDemo");
    expect(cube.commands).toEqual([]);

    await show.startDemo();
    expect(audio.resetPlaylist).toHaveBeenCalledOnce();
    expect(cube.commands).toEqual(["DEMO_START"]);
    expect(show.getSnapshot().state).toBe("standby");
  });

  it("waits for every operation and ends a normal demo with DEMO_END", async () => {
    const cube = new FakeCubeController();
    const show = new ShowController(cube, generator, audio);
    await show.startDemo();
    show.analyze();
    await vi.advanceTimersByTimeAsync(showConfig.analyzerDurationMs);
    const estimatedMoves = show.getSnapshot().estimatedMoves;
    await show.execute();

    expect(cube.operations).toHaveLength(showConfig.maxOperations);
    expect(audio.maybePlay).toHaveBeenCalledTimes(showConfig.maxOperations);
    expect(audio.maybePlay).toHaveBeenNthCalledWith(1, 1, estimatedMoves);
    expect(audio.maybePlay).toHaveBeenLastCalledWith(showConfig.maxOperations, estimatedMoves);
    expect(audio.playPhase).toHaveBeenCalledOnce();
    expect(audio.playPhase).toHaveBeenCalledWith(4);
    expect(cube.commands.at(-1)).toBe("DEMO_END");
    expect(show.getSnapshot().state).toBe("preDemo");
    expect(cube.status).toBe("idle");
  });

  it("cancels only from standby and returns to pre-demo after releasing the cube", async () => {
    const cube = new FakeCubeController();
    const show = new ShowController(cube, generator, audio);

    await show.cancelDemo();
    expect(cube.commands).toEqual([]);

    await show.startDemo();
    let releaseEndDemo!: () => void;
    cube.endDemoWait = new Promise<void>((resolve) => { releaseEndDemo = resolve; });
    const cancellation = show.cancelDemo();

    expect(show.getSnapshot().state).toBe("cancelingDemo");
    expect(cube.commands).toEqual(["DEMO_START", "DEMO_END"]);
    await show.cancelDemo();
    expect(cube.commands).toEqual(["DEMO_START", "DEMO_END"]);

    releaseEndDemo();
    await cancellation;
    expect(show.getSnapshot().state).toBe("preDemo");
    expect(show.getSnapshot().connected).toBe(true);
    expect(cube.status).toBe("idle");
  });

  it("uses STOP but never DEMO_END after an operation error", async () => {
    const cube = new FakeCubeController();
    cube.operationError = new Error("MACHINE RESPONSE TIMEOUT");
    const show = new ShowController(cube, generator, audio);
    await show.startDemo();
    show.analyze();
    await vi.advanceTimersByTimeAsync(showConfig.analyzerDurationMs);
    await show.execute();

    expect(show.getSnapshot().state).toBe("error");
    expect(cube.commands).toContain("STOP");
    expect(cube.commands).not.toContain("DEMO_END");
    expect(audio.playPhase).not.toHaveBeenCalled();
  });
});
