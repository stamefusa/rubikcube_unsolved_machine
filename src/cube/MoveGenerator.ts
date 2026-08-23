import type { CubeFace, CubeMove, MoveDirection } from "./CubeMove";

const faces: CubeFace[] = ["R", "L", "U", "D", "F", "B"];
const directions: MoveDirection[] = ["CW", "CCW"];

export class MoveGenerator {
  private previous: CubeMove | null = null;

  next(): CubeMove {
    // This intentionally knows nothing about cube state or the fake analysis result.
    if (this.previous && Math.random() < 0.16) {
      this.previous = {
        face: this.previous.face,
        direction: this.previous.direction === "CW" ? "CCW" : "CW",
      };
      return this.previous;
    }

    const reuseFace = this.previous && Math.random() < 0.25;
    this.previous = {
      face: reuseFace ? this.previous!.face : faces[Math.floor(Math.random() * faces.length)],
      direction: directions[Math.floor(Math.random() * directions.length)],
    };
    return this.previous;
  }

  reset() { this.previous = null; }
}
