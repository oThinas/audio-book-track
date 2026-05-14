// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BookFocusWeekBadge } from "@/components/features/books/book-focus-week-badge";

describe("BookFocusWeekBadge", () => {
  it("returns null when count=0 (no badge rendered)", () => {
    const { container } = render(<BookFocusWeekBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the exact text when count=1", () => {
    render(<BookFocusWeekBadge count={1} />);
    expect(screen.getByText("Foco da semana · 1")).toBeTruthy();
  });

  it("renders the exact text when count=50", () => {
    render(<BookFocusWeekBadge count={50} />);
    expect(screen.getByText("Foco da semana · 50")).toBeTruthy();
  });
});
