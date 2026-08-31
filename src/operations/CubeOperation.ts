export type CubeFace = "R" | "L" | "F" | "B";

export type CubeAxis = "RL" | "FB";

export type CubeOperation =
  | { type: "faceTurn"; face: CubeFace }
  | { type: "faceHesitation"; face: CubeFace }
  | { type: "thinking" }
  | { type: "wholeRotation"; axis: CubeAxis };

export function formatOperation(operation: CubeOperation) {
  if (operation.type === "thinking") return "THINK";
  return operation.type === "wholeRotation" ? operation.axis : operation.face;
}

export function operationCommand(operation: CubeOperation) {
  if (operation.type === "faceTurn") return `MOVE ${operation.face}`;
  if (operation.type === "faceHesitation") return `MOVE ${operation.face} HESITATE`;
  if (operation.type === "thinking") return "THINK";
  return `ROTATE ${operation.axis}`;
}

export function operationsEqual(left: CubeOperation, right: CubeOperation) {
  if (left.type !== right.type) return false;
  if (left.type === "faceTurn" && right.type === "faceTurn") return left.face === right.face;
  if (left.type === "faceHesitation" && right.type === "faceHesitation") return left.face === right.face;
  if (left.type === "wholeRotation" && right.type === "wholeRotation") return left.axis === right.axis;
  return left.type === "thinking" && right.type === "thinking";
}

export function operationResponseMatches(expected: CubeOperation, response: CubeOperation) {
  if (expected.type === "faceHesitation" && response.type === "faceTurn") {
    return expected.face === response.face;
  }
  return operationsEqual(expected, response);
}
