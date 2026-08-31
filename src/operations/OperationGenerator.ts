import { showConfig } from "../config/showConfig";
import type { CubeAxis, CubeFace, CubeOperation } from "./CubeOperation";

const faces: readonly CubeFace[] = ["R", "L", "F", "B"];
const axes: readonly CubeAxis[] = ["RL", "FB"];

export class OperationGenerator {
  constructor(
    private wholeRotationProbability = showConfig.wholeRotationProbability,
    private faceHesitationProbability = showConfig.faceHesitationProbability,
    private thinkingProbability = showConfig.thinkingProbability,
    private random: () => number = Math.random,
  ) {}

  nextOperation(): CubeOperation {
    const selection = this.random();
    if (selection < this.thinkingProbability) {
      return { type: "thinking" };
    }
    if (selection < this.thinkingProbability + this.faceHesitationProbability) {
      return { type: "faceHesitation", face: faces[Math.floor(this.random() * faces.length)] };
    }
    if (selection < this.thinkingProbability + this.faceHesitationProbability + this.wholeRotationProbability) {
      return { type: "wholeRotation", axis: axes[Math.floor(this.random() * axes.length)] };
    }
    return { type: "faceTurn", face: faces[Math.floor(this.random() * faces.length)] };
  }

  reset() {
    // Reserved for future stateful generation without exposing cube state to the UI.
  }
}
