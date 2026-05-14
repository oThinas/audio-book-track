// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChapterFocusWeekToggle } from "@/components/features/chapters/chapter-focus-week-toggle";

describe("ChapterFocusWeekToggle", () => {
  it('renders the "Foco da semana" label and aria-pressed=false when disabled', () => {
    render(<ChapterFocusWeekToggle enabled={false} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /foco da semana/i });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("aria-pressed=true when enabled", () => {
    render(<ChapterFocusWeekToggle enabled={true} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /foco da semana/i });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("fires onToggle on click", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ChapterFocusWeekToggle enabled={false} onToggle={onToggle} />);
    await user.click(screen.getByRole("button", { name: /foco da semana/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
