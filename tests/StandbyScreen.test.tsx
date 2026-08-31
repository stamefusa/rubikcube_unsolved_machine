import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StandbyScreen } from "../src/components/StandbyScreen";
import type { ShowState } from "../src/show/showState";

function render(state: ShowState) {
  return renderToStaticMarkup(
    <StandbyScreen
      state={state}
      connected
      mockMode={false}
      error={null}
      onConnect={() => undefined}
      onStartDemo={() => undefined}
      onAnalyze={() => undefined}
      onCancelDemo={() => undefined}
    />,
  );
}

describe("StandbyScreen setup cancellation", () => {
  it("shows the secondary cancellation only after DEMO_START completes", () => {
    expect(render("standby")).toContain("CANCEL DEMO");
    expect(render("preDemo")).not.toContain("CANCEL DEMO");
    expect(render("startingDemo")).not.toContain("CANCEL DEMO");
  });

  it("hides cancellation and reports release progress while DEMO_END is pending", () => {
    const markup = render("cancelingDemo");
    expect(markup).toContain("RELEASING CUBE");
    expect(markup).not.toContain("CANCEL DEMO");
  });
});
