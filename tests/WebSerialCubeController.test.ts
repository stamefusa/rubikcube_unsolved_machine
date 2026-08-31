import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSerialCubeController } from "../src/serial/WebSerialCubeController";

class FakeSerialPort implements SerialPort {
  readonly writes: string[] = [];
  private readableController: ReadableStreamDefaultController<Uint8Array> | null = null;
  private decoder = new TextDecoder();
  readable: ReadableStream<Uint8Array> | null = new ReadableStream({
    start: (controller) => { this.readableController = controller; },
  });
  writable: WritableStream<Uint8Array> | null = new WritableStream({
    write: (value) => {
      const command = this.decoder.decode(value).trim();
      this.writes.push(command);
      if (command === "PING") queueMicrotask(() => this.emit("PONG"));
    },
  });

  async open() {}
  async close() {}

  emit(line: string) {
    this.readableController?.enqueue(new TextEncoder().encode(`${line}\n`));
  }
}

function installSerial(port: FakeSerialPort) {
  let disconnectListener: ((event: Event) => void) | null = null;
  const serial: Serial = {
    requestPort: async () => port,
    addEventListener: (_type, listener) => { disconnectListener = listener; },
    removeEventListener: (_type, listener) => {
      if (disconnectListener === listener) disconnectListener = null;
    },
  };
  vi.stubGlobal("navigator", { serial });
  vi.stubGlobal("window", globalThis);
  return { disconnect: () => disconnectListener?.(new Event("disconnect")) };
}

async function flush() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("WebSerialCubeController", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends v3 commands and resolves on the matching DONE without waiting for READY", async () => {
    const port = new FakeSerialPort();
    installSerial(port);
    const controller = new WebSerialCubeController();
    const onOperationStart = vi.fn();
    controller.onOperationStart(onOperationStart);
    await controller.connect();

    const startDemo = controller.startDemo();
    await flush();
    expect(port.writes.at(-1)).toBe("DEMO_START");
    port.emit("DEMO_START_START");
    port.emit("DEMO_START_DONE");
    await startDemo;

    const operation = controller.executeOperation({ type: "faceTurn", face: "R" });
    let completed = false;
    void operation.then(() => { completed = true; });
    await flush();
    expect(port.writes.at(-1)).toBe("MOVE R");
    port.emit("MOVE_START R");
    await flush();
    expect(completed).toBe(false);
    port.emit("MOVE_DONE R");
    await operation;
    expect(completed).toBe(true);

    const hesitation = controller.executeOperation({ type: "faceHesitation", face: "L" });
    await flush();
    expect(port.writes.at(-1)).toBe("MOVE L HESITATE");
    port.emit("MOVE_START L");
    port.emit("MOVE_DONE L");
    await hesitation;
    expect(onOperationStart).toHaveBeenLastCalledWith({ type: "faceHesitation", face: "L" });

    const thinking = controller.executeOperation({ type: "thinking" });
    await flush();
    expect(port.writes.at(-1)).toBe("THINK");
    port.emit("THINK_START");
    port.emit("THINK_DONE");
    await thinking;
    expect(onOperationStart).toHaveBeenLastCalledWith({ type: "thinking" });

    const rotation = controller.executeOperation({ type: "wholeRotation", axis: "FB" });
    await flush();
    expect(port.writes.at(-1)).toBe("ROTATE FB");
    port.emit("ROTATE_DONE FB");
    await rotation;

    const endDemo = controller.endDemo();
    await flush();
    expect(port.writes.at(-1)).toBe("DEMO_END");
    port.emit("DEMO_END_DONE");
    await endDemo;

    const status = controller.getStatus();
    await flush();
    expect(port.writes.at(-1)).toBe("STATUS");
    port.emit("IDLE");
    await expect(status).resolves.toBe("idle");
    await controller.disconnect();
  });

  it("rejects an operation when DONE identifies another operation", async () => {
    const port = new FakeSerialPort();
    installSerial(port);
    const controller = new WebSerialCubeController();
    await controller.connect();

    const operation = controller.executeOperation({ type: "faceTurn", face: "R" });
    port.emit("MOVE_DONE L");
    await expect(operation).rejects.toThrow("OPERATION DONE MISMATCH");
    await controller.disconnect();
  });

  it("waits for a stable state after STOP", async () => {
    const port = new FakeSerialPort();
    installSerial(port);
    const controller = new WebSerialCubeController();
    await controller.connect();

    const operation = controller.executeOperation({ type: "wholeRotation", axis: "RL" });
    const operationRejected = expect(operation).rejects.toThrow("OPERATION STOPPED");
    const stop = controller.stop();
    let stopped = false;
    void stop.then(() => { stopped = true; });
    await operationRejected;
    await flush();
    expect(port.writes.at(-1)).toBe("STOP");
    expect(stopped).toBe(false);
    port.emit("READY");
    await stop;
    expect(stopped).toBe(true);
    await controller.disconnect();
  });

  it.each([
    ["BUSY", "ARDUINO BUSY"],
    ["ERROR BUSY", "ARDUINO ERROR: BUSY"],
  ])("stops the active request on %s", async (response, expectedError) => {
    const port = new FakeSerialPort();
    installSerial(port);
    const controller = new WebSerialCubeController();
    await controller.connect();

    const operation = controller.executeOperation({ type: "faceTurn", face: "F" });
    port.emit(response);
    await expect(operation).rejects.toThrow(expectedError);
    expect(controller.isBusy()).toBe(false);
    await controller.disconnect();
  });

  it("rejects a command that does not receive DONE before the configured timeout", async () => {
    const port = new FakeSerialPort();
    installSerial(port);
    const controller = new WebSerialCubeController();
    await controller.connect();
    vi.useFakeTimers();

    const operation = controller.executeOperation({ type: "faceTurn", face: "B" });
    const rejected = expect(operation).rejects.toThrow("MACHINE RESPONSE TIMEOUT");
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    expect(controller.isBusy()).toBe(false);
    await controller.disconnect();
  });

  it("rejects the active operation and reports an asynchronous disconnect", async () => {
    const port = new FakeSerialPort();
    const serial = installSerial(port);
    const controller = new WebSerialCubeController();
    const onError = vi.fn();
    controller.onError(onError);
    await controller.connect();

    const operation = controller.executeOperation({ type: "wholeRotation", axis: "RL" });
    serial.disconnect();
    await expect(operation).rejects.toThrow("SERIAL CONNECTION LOST");
    expect(onError).toHaveBeenCalledOnce();
    expect(controller.isConnected()).toBe(false);
    await controller.disconnect();
  });
});
