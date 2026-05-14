// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BookFocusWeekBadge } from "@/components/features/books/book-focus-week-badge";

describe("BookFocusWeekBadge", () => {
  it("retorna null quando count=0 (sem badge)", () => {
    const { container } = render(<BookFocusWeekBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza com texto exato quando count=1", () => {
    render(<BookFocusWeekBadge count={1} />);
    expect(screen.getByText("Foco da semana · 1")).toBeTruthy();
  });

  it("renderiza com texto exato quando count=50", () => {
    render(<BookFocusWeekBadge count={50} />);
    expect(screen.getByText("Foco da semana · 50")).toBeTruthy();
  });
});
