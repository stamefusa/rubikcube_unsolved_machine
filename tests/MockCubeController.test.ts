import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showConfig } from "../src/config/showConfig";
import { MockCubeController } from "../src/serial/MockCubeController";

describe("MockCubeController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reproduces the IDLE -> READY -> IDLE demo lifecycle", async () => {
    const controller = new MockCubeController();
    expect(await controller.getStatus()).toBe("idle");

    const startDemo = controller.startDemo();
    expect(controller.isBusy()).toBe(true);
    await vi.advanceTimersByTimeAsync(showConfig.mock.startDelayMs + showConfig.mock.startDemoDurationMs);
    await startDemo;
    expect(await controller.getStatus()).toBe("ready");

    let started = false;
    controller.onOperationStart(() => { started = true; });
    const operation = controller.executeOperation({ type: "wholeRotation", axis: "RL" });
    let completed = false;
    void operation.then(() => { completed = true; });
    await vi.advanceTimersByTimeAsync(showConfig.mock.startDelayMs);
    expect(started).toBe(true);
    expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(showConfig.mock.wholeRotationDurationMs);
    await operation;
    expect(completed).toBe(true);
    expect(await controller.getStatus()).toBe("ready");

    const endDemo = controller.endDemo();
    await vi.advanceTimersByTimeAsync(showConfig.mock.startDelayMs + showConfig.mock.endDemoDurationMs);
    await endDemo;
    expect(await controller.getStatus()).toBe("idle");
  });

  it("uses STOP without changing it into DEMO_END", async () => {
    const controller = new MockCubeController();
    const startDemo = controller.startDemo();
    await vi.advanceTimersByTimeAsync(showConfig.mock.startDelayMs + showConfig.mock.startDemoDurationMs);
    await startDemo;

    const operation = controller.executeOperation({ type: "faceTurn", face: "R" });
    const rejected = expect(operation).rejects.toThrow("OPERATION STOPPED");
    await controller.stop();
    await rejected;
    expect(await controller.getStatus()).toBe("ready");
  });
});
