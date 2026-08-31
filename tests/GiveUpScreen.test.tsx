import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GiveUpScreen } from "../src/components/GiveUpScreen";
import type { ShowState } from "../src/show/showState";

function render(state: ShowState, error: string | null = null) {
  return renderToStaticMarkup(
    <GiveUpScreen
      state={state}
      error={error}
      moveCount={18}
      recovering={false}
      onReset={() => undefined}
      onReturnToStart={() => undefined}
    />,
  );
}

describe("GiveUpScreen release completion", () => {
  it("keeps the failed result and offers an explicit return after release", () => {
    const markup = render("releaseComplete");

    expect(markup).toContain("FAILED");
    expect(markup).toContain("CUBE RELEASED / DEMO COMPLETE");
    expect(markup).toContain("RETURN TO DEMO START");
    expect(markup).toContain("18");
  });

  it("does not offer return while the cube is still releasing", () => {
    const markup = render("endingDemo");

    expect(markup).toContain("RELEASING");
    expect(markup).not.toContain("RETURN TO DEMO START");
  });

  it("keeps the error recovery action separate", () => {
    const markup = render("error", "SERIAL CONNECTION LOST");

    expect(markup).toContain("RESET SYSTEM");
    expect(markup).not.toContain("RETURN TO DEMO START");
  });
});
