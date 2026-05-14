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
  it("exibe — quando deadline=null", () => {
    const { container } = render(
      <ChapterDeadlineCell deadline={null} status="pending" focusContext={ctx} />,
    );
    expect(container.textContent).toContain("—");
    expect(screen.queryByText("Atrasado")).toBeNull();
  });

  it("exibe a data formatada quando deadline tem valor (não atrasado)", () => {
    render(<ChapterDeadlineCell deadline="2026-06-15" status="pending" focusContext={ctx} />);
    expect(screen.getByText("15/06/2026")).toBeTruthy();
    expect(screen.queryByText("Atrasado")).toBeNull();
  });

  it("renderiza com destaque + texto sr-only 'Atrasado' quando passado em status ativo", () => {
    render(<ChapterDeadlineCell deadline="2026-05-09" status="pending" focusContext={ctx} />);
    expect(screen.getByText("Atrasado")).toBeTruthy();
    const overdueSpan = screen.getByText("Atrasado").parentElement as HTMLElement;
    expect(overdueSpan.className).toContain("text-destructive");
  });

  it("não destaca quando passado mas status é completed", () => {
    render(<ChapterDeadlineCell deadline="2026-05-09" status="completed" focusContext={ctx} />);
    expect(screen.queryByText("Atrasado")).toBeNull();
  });

  it("não destaca quando passado mas status é paid", () => {
    render(<ChapterDeadlineCell deadline="2026-05-09" status="paid" focusContext={ctx} />);
    expect(screen.queryByText("Atrasado")).toBeNull();
  });

  it("não destaca quando deadline = hoje em status ativo", () => {
    render(<ChapterDeadlineCell deadline="2026-05-14" status="pending" focusContext={ctx} />);
    expect(screen.queryByText("Atrasado")).toBeNull();
  });
});
