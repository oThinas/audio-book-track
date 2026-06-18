// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { useScrollIntoViewOnEnter } from "@/hooks/use-scroll-into-view-on-enter";

function Probe({ entering }: { entering: boolean }) {
  const setRef = useScrollIntoViewOnEnter(entering);
  return <div data-testid="probe" ref={setRef} />;
}

describe("useScrollIntoViewOnEnter", () => {
  let scrollIntoView: MockInstance;

  beforeEach(() => {
    scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
  });

  afterEach(() => {
    scrollIntoView.mockRestore();
  });

  it("does not scroll a row that is not entering", () => {
    render(<Probe entering={false} />);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls into view (minimally) when a row mounts already entering", () => {
    render(<Probe entering={true} />);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("scrolls into view when a row transitions into the entering state", () => {
    const { rerender } = render(<Probe entering={false} />);
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(<Probe entering={true} />);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("does not scroll again once the entering state clears to idle", () => {
    const { rerender } = render(<Probe entering={true} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(<Probe entering={false} />);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
