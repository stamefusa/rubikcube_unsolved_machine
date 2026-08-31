import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExecuteScreen } from "../src/components/ExecuteScreen";

function render(moveCount: number) {
  return renderToStaticMarkup(
    <ExecuteScreen state="desperate" moveCount={moveCount} estimatedMoves={12} />,
  );
}

describe("ExecuteScreen shortened recovery phase", () => {
  it("starts the final recovery status for the last three operations", () => {
    expect(render(15)).toContain("SOLUTION DEVIATION DETECTED");
    expect(render(16)).toContain("RECOVERY ATTEMPT");
    expect(render(18)).toContain("RECOVERY ATTEMPT");
  });
});
