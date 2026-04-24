// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { MoneyInput } from "@/components/ui/money-input";

function Harness({
  initial,
  min,
  max,
}: {
  readonly initial?: number;
  readonly min?: number;
  readonly max?: number;
}) {
  const [value, setValue] = useState<number>(initial ?? 0);
  return (
    <>
      <MoneyInput
        id="money"
        value={value}
        onChange={setValue}
        min={min}
        max={max}
        aria-label="Valor"
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

function getInput(): HTMLInputElement {
  return screen.getByLabelText(/valor/i) as HTMLInputElement;
}

describe("MoneyInput (cents-first)", () => {
  it("renders the formatted BRL value from the prop (controlled)", () => {
    render(<Harness initial={8500} />);
    expect(getInput().value).toMatch(/R\$\s*85,00/);
  });

  it("initial zero value displays R$ 0,00", () => {
    render(<Harness />);
    expect(getInput().value).toMatch(/R\$\s*0,00/);
  });

  it("typing a single digit accumulates as cents (8 → R$ 0,08)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "8");
    expect(screen.getByTestId("value").textContent).toBe("8");
    expect(input.value).toMatch(/R\$\s*0,08/);
  });

  it("typing a sequence (8,5,0,0) results in R$ 85,00", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "8500");
    expect(screen.getByTestId("value").textContent).toBe("8500");
    expect(input.value).toMatch(/R\$\s*85,00/);
  });

  it("typing 6 nines reaches R$ 9.999,99 when no max is set", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "999999");
    expect(input.value).toMatch(/R\$\s*9\.999,99/);
  });

  it("clamps to max when additional digits would exceed it", async () => {
    const user = userEvent.setup();
    render(<Harness max={999_999} />);
    const input = getInput();
    await user.type(input, "9999999");
    expect(input.value).toMatch(/R\$\s*9\.999,99/);
  });

  it("ignores non-numeric characters", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "a,.-");
    expect(input.value).toMatch(/R\$\s*0,00/);
    expect(screen.getByTestId("value").textContent).toBe("0");
  });

  it("Backspace removes the last accumulated digit", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "8500");
    expect(input.value).toMatch(/R\$\s*85,00/);
    await user.type(input, "{Backspace}");
    expect(input.value).toMatch(/R\$\s*8,50/);
    await user.type(input, "{Backspace}");
    expect(input.value).toMatch(/R\$\s*0,85/);
    await user.type(input, "{Backspace}");
    expect(input.value).toMatch(/R\$\s*0,08/);
    await user.type(input, "{Backspace}");
    expect(input.value).toMatch(/R\$\s*0,00/);
    await user.type(input, "{Backspace}");
    expect(input.value).toMatch(/R\$\s*0,00/);
  });

  it("paste extracts digits and applies them in order (no max)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.click(input);
    await user.paste("R$ 1.234,56");
    expect(input.value).toMatch(/R\$\s*1\.234,56/);
  });

  it("paste containing no digits is a no-op", async () => {
    const user = userEvent.setup();
    render(<Harness initial={5000} />);
    const input = getInput();
    await user.click(input);
    await user.paste("abc");
    expect(input.value).toMatch(/R\$\s*50,00/);
  });

  it("paste clamps to max (studios: 999_999 cents)", async () => {
    const user = userEvent.setup();
    render(<Harness max={999_999} />);
    const input = getInput();
    await user.click(input);
    await user.paste("12345678");
    expect(input.value).toMatch(/R\$\s*9\.999,99/);
  });

  it("does not clamp to min during typing (cents-first UX preserved)", async () => {
    const user = userEvent.setup();
    render(<Harness min={100} />);
    const input = getInput();
    await user.type(input, "5");
    // Typing "5" builds up 5 cents; clamping to min=100 at this point would
    // skip the R$ 0,05 → R$ 0,50 → R$ 5,00 progression. The display must
    // follow the user's digits.
    expect(input.value).toMatch(/R\$\s*0,05/);
    expect(screen.getByTestId("value").textContent).toBe("5");
  });

  it("snaps to min on blur when value is non-zero and below min", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness min={100} />
        <button type="button">other</button>
      </>,
    );
    const input = getInput();
    await user.type(input, "5");
    expect(input.value).toMatch(/R\$\s*0,05/);
    await user.click(screen.getByRole("button", { name: "other" }));
    expect(input.value).toMatch(/R\$\s*1,00/);
  });

  it("leaves zero untouched on blur even when min > 0 (empty state)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness min={100} />
        <button type="button">other</button>
      </>,
    );
    const input = getInput();
    await user.click(input);
    await user.click(screen.getByRole("button", { name: "other" }));
    expect(input.value).toMatch(/R\$\s*0,00/);
  });

  it("leaves value untouched on blur when already ≥ min", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness initial={500} min={100} />
        <button type="button">other</button>
      </>,
    );
    const input = getInput();
    await user.click(input);
    await user.click(screen.getByRole("button", { name: "other" }));
    expect(input.value).toMatch(/R\$\s*5,00/);
  });

  it("calls the forwarded onBlur after internal blur handling", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    function WithBlur() {
      const [value, setValue] = useState(0);
      return (
        <>
          <MoneyInput value={value} onChange={setValue} onBlur={onBlur} aria-label="Valor" />
          <button type="button">other</button>
        </>
      );
    }
    render(<WithBlur />);
    await user.click(screen.getByLabelText(/valor/i));
    await user.click(screen.getByRole("button", { name: "other" }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("uses type=text and inputMode=numeric (mobile numeric keyboard)", () => {
    render(<Harness />);
    const input = getInput();
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("inputMode")).toBe("numeric");
  });

  it("forwards aria-invalid to the underlying input", () => {
    const { rerender } = render(
      <MoneyInput value={0} onChange={() => {}} aria-invalid aria-label="v" />,
    );
    expect((screen.getByLabelText(/v/i) as HTMLInputElement).getAttribute("aria-invalid")).toBe(
      "true",
    );
    rerender(<MoneyInput value={0} onChange={() => {}} aria-label="v" />);
    expect((screen.getByLabelText(/v/i) as HTMLInputElement).getAttribute("aria-invalid")).toBe(
      null,
    );
  });

  it("is disabled when disabled prop is true", () => {
    render(<MoneyInput value={1000} onChange={() => {}} disabled aria-label="v" />);
    expect((screen.getByLabelText(/v/i) as HTMLInputElement).disabled).toBe(true);
  });
});
