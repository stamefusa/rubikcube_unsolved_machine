import type { CubeAxis, CubeFace, CubeOperation } from "../operations/CubeOperation";

export type SerialMessage =
  | { type: "IDLE" | "READY" | "PONG" | "BUSY" }
  | { type: "DEMO_START_START" | "DEMO_START_DONE" | "DEMO_END_START" | "DEMO_END_DONE" }
  | { type: "MOVE_START" | "MOVE_DONE"; operation: Extract<CubeOperation, { type: "faceTurn" }> }
  | { type: "THINK_START" | "THINK_DONE"; operation: Extract<CubeOperation, { type: "thinking" }> }
  | { type: "ROTATE_START" | "ROTATE_DONE"; operation: Extract<CubeOperation, { type: "wholeRotation" }> }
  | { type: "ERROR"; code: string }
  | { type: "UNKNOWN"; raw: string };

const simpleMessages = new Set([
  "IDLE", "READY", "PONG", "BUSY",
  "DEMO_START_START", "DEMO_START_DONE", "DEMO_END_START", "DEMO_END_DONE",
]);
const faces = new Set<CubeFace>(["R", "L", "F", "B"]);
const axes = new Set<CubeAxis>(["RL", "FB"]);

export function parseSerialLine(raw: string): SerialMessage {
  const line = raw.trim();
  if (simpleMessages.has(line)) {
    return { type: line as "IDLE" | "READY" | "PONG" | "BUSY" | "DEMO_START_START" | "DEMO_START_DONE" | "DEMO_END_START" | "DEMO_END_DONE" };
  }

  const [type, argument, ...extra] = line.split(/\s+/);
  if ((type === "MOVE_START" || type === "MOVE_DONE") && faces.has(argument as CubeFace) && extra.length === 0) {
    return { type, operation: { type: "faceTurn", face: argument as CubeFace } };
  }
  if ((type === "THINK_START" || type === "THINK_DONE") && argument === undefined) {
    return { type, operation: { type: "thinking" } };
  }
  if ((type === "ROTATE_START" || type === "ROTATE_DONE") && axes.has(argument as CubeAxis) && extra.length === 0) {
    return { type, operation: { type: "wholeRotation", axis: argument as CubeAxis } };
  }
  if (type === "ERROR" && argument) return { type: "ERROR", code: [argument, ...extra].join(" ") };
  return { type: "UNKNOWN", raw: line };
}
