import { showConfig } from "../config/showConfig";
import type { CubeAxis, CubeFace, CubeOperation } from "./CubeOperation";

const faces: readonly CubeFace[] = ["R", "L", "F", "B"];
const axes: readonly CubeAxis[] = ["RL", "FB"];

export class OperationGenerator {
  constructor(
    private wholeRotationProbability = showConfig.wholeRotationProbability,
    private random: () => number = Math.random,
  ) {}

  nextOperation(): CubeOperation {
    if (this.random() < this.wholeRotationProbability) {
      return { type: "wholeRotation", axis: axes[Math.floor(this.random() * axes.length)] };
    }
    return { type: "faceTurn", face: faces[Math.floor(this.random() * faces.length)] };
  }

  reset() {
    // Reserved for future stateful generation without exposing cube state to the UI.
  }
}
