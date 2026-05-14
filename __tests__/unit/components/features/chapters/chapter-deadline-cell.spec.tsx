// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChapterDeadlineCell } from "@/components/features/chapters/chapter-deadline-cell";
import type { FocusWeekContext } from "@/lib/domain/chapter-deadline";

const ctx: FocusWeekContext = {
  todayIso: "2026-05-14",
  mondayIso: "2026-05-11",
  sundayIso: "2026-05-17",
};

describe("ChapterDeadlineCell", () => {
  it("renders the dash placeholder when deadline is null", () => {
    const { container } = render(
      <ChapterDeadlineCell deadline={null} status="pending" focusContext={ctx} />,
    );
    expect(container.textContent).toContain("—");
    expect(screen.queryByText("Atrasado")).toBeNull();
  });

  it("renders the formatted date when deadline is set (not overdue)", () => {
    render(<ChapterDeadlineCell deadline="2026-06-15" status="pending" focusContext={ctx} />);
    expect(screen.getByText("15/06/2026")).toBeTruthy();
    expect(screen.queryByText("Atrasado")).toBeNull();
  });

  it('renders with destructive style + sr-only "Atrasado" when overdue in an active status', () => {
    render(<ChapterDeadlineCell deadline="2026-05-09" status="pending" focusContext={ctx} />);
    expect(screen.getByText("Atrasado")).toBeTruthy();
    const overdueSpan = screen.getByText("Atrasado").parentElement as HTMLElement;
    expect(overdueSpan.className).toContain("text-destructive");
  });

  it("does not highlight when deadline is past but status is completed", () => {
    render(<ChapterDeadlineCell deadline="2026-05-09" status="completed" focusContext={ctx} />);
    expect(screen.queryByText("Atrasado")).toBeNull();
  });

  it("does not highlight when deadline is past but status is paid", () => {
    render(<ChapterDeadlineCell deadline="2026-05-09" status="paid" focusContext={ctx} />);
    expect(screen.queryByText("Atrasado")).toBeNull();
  });

  it("does not highlight when deadline equals today in an active status", () => {
    render(<ChapterDeadlineCell deadline="2026-05-14" status="pending" focusContext={ctx} />);
    expect(screen.queryByText("Atrasado")).toBeNull();
  });
});
