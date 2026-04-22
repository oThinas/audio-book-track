// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

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

function typeDigit(input: HTMLInputElement, digit: string) {
  const event = new InputEvent("beforeinput", {
    data: digit,
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
  });
  fireEvent(input, event);
}

describe("MoneyInput", () => {
  it("renders the formatted BRL value from the prop (controlled)", () => {
    render(<Harness initial={85} />);
    expect(getInput().value).toMatch(/R\$\s*85,00/);
  });

  it("initial zero value displays R$ 0,00", () => {
    render(<Harness />);
    expect(getInput().value).toMatch(/R\$\s*0,00/);
  });

  it("typing a single digit accumulates as cents (8 → R$ 0,08)", () => {
    render(<Harness />);
    const input = getInput();
    typeDigit(input, "8");
    expect(screen.getByTestId("value").textContent).toBe("0.08");
    expect(input.value).toMatch(/R\$\s*0,08/);
  });

  it("typing a sequence (8,5,0,0) results in R$ 85,00", () => {
    render(<Harness />);
    const input = getInput();
    typeDigit(input, "8");
    typeDigit(input, "5");
    typeDigit(input, "0");
    typeDigit(input, "0");
    expect(screen.getByTestId("value").textContent).toBe("85");
    expect(input.value).toMatch(/R\$\s*85,00/);
  });

  it("typing 6 nines accumulates R$ 9.999,99", () => {
    render(<Harness max={9999.99} />);
    const input = getInput();
    for (let i = 0; i < 6; i++) typeDigit(input, "9");
    expect(input.value).toMatch(/R\$\s*9\.999,99/);
  });

  it("clamps to max when additional digits would exceed it", () => {
    render(<Harness max={9999.99} />);
    const input = getInput();
    for (let i = 0; i < 6; i++) typeDigit(input, "9");
    typeDigit(input, "9");
    expect(input.value).toMatch(/R\$\s*9\.999,99/);
  });

  it("ignores non-numeric characters", () => {
    render(<Harness />);
    const input = getInput();
    typeDigit(input, "a");
    typeDigit(input, ",");
    typeDigit(input, ".");
    typeDigit(input, "-");
    expect(input.value).toMatch(/R\$\s*0,00/);
    expect(screen.getByTestId("value").textContent).toBe("0");
  });

  it("Backspace removes the last accumulated digit", () => {
    render(<Harness />);
    const input = getInput();
    typeDigit(input, "8");
    typeDigit(input, "5");
    typeDigit(input, "0");
    typeDigit(input, "0");
    expect(input.value).toMatch(/R\$\s*85,00/);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(input.value).toMatch(/R\$\s*8,50/);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(input.value).toMatch(/R\$\s*0,85/);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(input.value).toMatch(/R\$\s*0,08/);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(input.value).toMatch(/R\$\s*0,00/);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(input.value).toMatch(/R\$\s*0,00/);
  });

  it("paste extracts digits and applies them in order (no max)", () => {
    render(<Harness />);
    const input = getInput();
    fireEvent.paste(input, {
      clipboardData: { getData: () => "R$ 1.234,56" },
    });
    expect(input.value).toMatch(/R\$\s*1\.234,56/);
  });

  it("paste respects max (studios: 9999.99)", () => {
    render(<Harness max={9999.99} />);
    const input = getInput();
    fireEvent.paste(input, {
      clipboardData: { getData: () => "12345678" },
    });
    expect(input.value).toMatch(/R\$\s*9\.999,99/);
  });

  it("paste containing no digits is a no-op", () => {
    render(<Harness initial={50} />);
    const input = getInput();
    fireEvent.paste(input, {
      clipboardData: { getData: () => "abc" },
    });
    expect(input.value).toMatch(/R\$\s*50,00/);
  });

  it("paste clamps to max", () => {
    render(<Harness max={5} />);
    const input = getInput();
    fireEvent.paste(input, {
      clipboardData: { getData: () => "999999" },
    });
    expect(input.value).toMatch(/R\$\s*5,00/);
  });

  it("respects max when accumulating via keystrokes (max=5 → never above R$ 5,00)", () => {
    render(<Harness max={5} />);
    const input = getInput();
    for (let i = 0; i < 8; i++) typeDigit(input, "9");
    const cents = Number(screen.getByTestId("value").textContent) * 100;
    expect(cents).toBeLessThanOrEqual(500);
    expect(input.value).toMatch(/R\$\s*5,00/);
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
    render(<MoneyInput value={10} onChange={() => {}} disabled aria-label="v" />);
    expect((screen.getByLabelText(/v/i) as HTMLInputElement).disabled).toBe(true);
  });
});
