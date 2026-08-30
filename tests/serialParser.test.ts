import { describe, expect, it } from "vitest";
import { parseSerialLine } from "../src/serial/serialParser";

describe("parseSerialLine", () => {
  it.each([
    "IDLE",
    "READY",
    "PONG",
    "BUSY",
    "DEMO_START_START",
    "DEMO_START_DONE",
    "DEMO_END_START",
    "DEMO_END_DONE",
  ] as const)("parses %s", (type) => {
    expect(parseSerialLine(` ${type}\r\n`)).toEqual({ type });
  });

  it("parses face and whole-cube operations without directions", () => {
    expect(parseSerialLine("MOVE_DONE R")).toEqual({
      type: "MOVE_DONE",
      operation: { type: "faceTurn", face: "R" },
    });
    expect(parseSerialLine("ROTATE_START FB")).toEqual({
      type: "ROTATE_START",
      operation: { type: "wholeRotation", axis: "FB" },
    });
  });

  it("rejects legacy and unsupported move formats", () => {
    expect(parseSerialLine("MOVE_DONE R CW").type).toBe("UNKNOWN");
    expect(parseSerialLine("MOVE_DONE U").type).toBe("UNKNOWN");
    expect(parseSerialLine("ROTATE_DONE UD").type).toBe("UNKNOWN");
  });

  it("keeps the complete Arduino error code", () => {
    expect(parseSerialLine("ERROR UNSAFE GRIP STATE")).toEqual({
      type: "ERROR",
      code: "UNSAFE GRIP STATE",
    });
  });
});
