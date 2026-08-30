export type CubeFace = "R" | "L" | "F" | "B";

export type CubeAxis = "RL" | "FB";

export type CubeOperation =
  | { type: "faceTurn"; face: CubeFace }
  | { type: "wholeRotation"; axis: CubeAxis };

export function formatOperation(operation: CubeOperation) {
  return operation.type === "faceTurn" ? operation.face : operation.axis;
}

export function operationCommand(operation: CubeOperation) {
  return operation.type === "faceTurn"
    ? `MOVE ${operation.face}`
    : `ROTATE ${operation.axis}`;
}

export function operationsEqual(left: CubeOperation, right: CubeOperation) {
  if (left.type !== right.type) return false;
  if (left.type === "faceTurn" && right.type === "faceTurn") return left.face === right.face;
  if (left.type === "wholeRotation" && right.type === "wholeRotation") return left.axis === right.axis;
  return false;
}
