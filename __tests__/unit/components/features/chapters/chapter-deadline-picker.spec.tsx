// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChapterDeadlinePicker } from "@/components/features/chapters/chapter-deadline-picker";

describe("ChapterDeadlinePicker", () => {
  it('shows "Definir prazo" when value is null', () => {
    render(<ChapterDeadlinePicker value={null} onChange={vi.fn()} />);
    const button = screen.getByRole("button", { name: /definir prazo/i });
    expect(button).toBeTruthy();
  });

  it("shows the date formatted in pt-BR when value is set", () => {
    render(<ChapterDeadlinePicker value="2026-06-15" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /15\/06\/2026/ })).toBeTruthy();
  });

  it('the "Limpar" button calls onChange(null)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChapterDeadlinePicker value="2026-06-15" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /15\/06\/2026/ }));
    const clearButton = await screen.findByRole("button", { name: /limpar/i });
    await user.click(clearButton);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("disables the trigger button when disabled=true", () => {
    render(<ChapterDeadlinePicker value="2026-06-15" onChange={vi.fn()} disabled />);
    const button = screen.getByRole("button", { name: /15\/06\/2026/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
