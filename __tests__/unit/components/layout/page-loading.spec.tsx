// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingStatus } from "@/components/layout/page-loading";

describe("LoadingStatus", () => {
  it("renders a status region with the page-loading-status testid", () => {
    render(<LoadingStatus />);

    const status = screen.getByRole("status");

    expect(status.getAttribute("data-testid")).toBe("page-loading-status");
  });

  it("announces loading exactly once via sr-only text", () => {
    render(<LoadingStatus />);

    const announcements = screen.getAllByText("Carregando…");

    expect(announcements).toHaveLength(1);
    expect(announcements[0]?.className).toContain("sr-only");
  });
});
