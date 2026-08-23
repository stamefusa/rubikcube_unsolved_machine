export type CubeFace = "R" | "L" | "U" | "D" | "F" | "B";
export type MoveDirection = "CW" | "CCW";

export interface CubeMove {
  face: CubeFace;
  direction: MoveDirection;
}

export const formatMove = (move: CubeMove) =>
  `${move.face}${move.direction === "CCW" ? "′" : ""}`;
