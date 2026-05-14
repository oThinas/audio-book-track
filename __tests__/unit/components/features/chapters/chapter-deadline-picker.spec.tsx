// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChapterDeadlinePicker } from "@/components/features/chapters/chapter-deadline-picker";

describe("ChapterDeadlinePicker", () => {
  it('exibe "Definir prazo" quando value=null', () => {
    render(<ChapterDeadlinePicker value={null} onChange={vi.fn()} />);
    const button = screen.getByRole("button", { name: /definir prazo/i });
    expect(button).toBeTruthy();
  });

  it("exibe a data formatada em pt-BR quando value tem valor", () => {
    render(<ChapterDeadlinePicker value="2026-06-15" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /15\/06\/2026/ })).toBeTruthy();
  });

  it('o botão "Limpar" chama onChange(null)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChapterDeadlinePicker value="2026-06-15" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /15\/06\/2026/ }));
    const clearButton = await screen.findByRole("button", { name: /limpar/i });
    await user.click(clearButton);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("quando disabled=true, o botão trigger está desabilitado", () => {
    render(<ChapterDeadlinePicker value="2026-06-15" onChange={vi.fn()} disabled />);
    const button = screen.getByRole("button", { name: /15\/06\/2026/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
