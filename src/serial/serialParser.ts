import type { CubeFace, CubeMove, MoveDirection } from "../cube/CubeMove";

export type SerialMessage =
  | { type: "READY" | "PONG" }
  | { type: "MOVE_START" | "MOVE_DONE"; move: CubeMove }
  | { type: "ERROR"; message: string }
  | { type: "UNKNOWN"; raw: string };

const faces = new Set(["R", "L", "U", "D", "F", "B"]);
const directions = new Set(["CW", "CCW"]);

export function parseSerialLine(raw: string): SerialMessage {
  const line = raw.trim();
  if (line === "READY" || line === "PONG") return { type: line };
  const [type, face, direction, ...rest] = line.split(/\s+/);
  if ((type === "MOVE_START" || type === "MOVE_DONE") && faces.has(face) && directions.has(direction)) {
    return { type, move: { face: face as CubeFace, direction: direction as MoveDirection } };
  }
  if (type === "ERROR") return { type: "ERROR", message: [face, direction, ...rest].filter(Boolean).join(" ") };
  return { type: "UNKNOWN", raw: line };
}
