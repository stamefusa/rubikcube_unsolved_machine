import { describe, expect, it } from "vitest";
import { OperationGenerator } from "../src/operations/OperationGenerator";

describe("OperationGenerator", () => {
  it("generates only supported face turns and whole rotations", () => {
    const values = [0.05, 0.8, 0.5, 0];
    const generator = new OperationGenerator(0.1, () => values.shift() ?? 0);

    expect(generator.nextOperation()).toEqual({ type: "wholeRotation", axis: "FB" });
    expect(generator.nextOperation()).toEqual({ type: "faceTurn", face: "R" });
  });
});
