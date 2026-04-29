// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { SecondsInput } from "@/components/ui/seconds-input";

function Harness({ initial, max }: { readonly initial?: number; readonly max?: number }) {
  const [value, setValue] = useState<number>(initial ?? 0);
  return (
    <>
      <SecondsInput id="seconds" value={value} onChange={setValue} max={max} aria-label="Duração" />
      <output data-testid="value">{value}</output>
    </>
  );
}

function getInput(): HTMLInputElement {
  return screen.getByLabelText(/duração/i) as HTMLInputElement;
}

describe("SecondsInput (HH:MM:SS timecode shift-register)", () => {
  it("renders the formatted HH:MM:SS value from the prop (controlled)", () => {
    render(<Harness initial={3661} />);
    expect(getInput().value).toBe("01:01:01");
  });

  it("initial zero value displays 00:00:00", () => {
    render(<Harness />);
    expect(getInput().value).toBe("00:00:00");
  });

  it("typing a single digit lands on the seconds slot (8 → 00:00:08)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "8");
    expect(screen.getByTestId("value").textContent).toBe("8");
    expect(input.value).toBe("00:00:08");
  });

  it("typing 12545 lands as 01:25:45 (each digit shifts the buffer left)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "12545");
    expect(input.value).toBe("01:25:45");
    expect(screen.getByTestId("value").textContent).toBe(String(1 * 3600 + 25 * 60 + 45));
  });

  it("typing 3600 yields 00:36:00 (positional, not decimal)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "3600");
    expect(input.value).toBe("00:36:00");
    expect(screen.getByTestId("value").textContent).toBe(String(36 * 60));
  });

  it("buffer is capped at 6 digits — extra typing shifts off the leftmost", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "12345678");
    // Last 6 digits ("345678") fill HH:MM:SS slots
    expect(input.value).toBe("34:56:78");
  });

  it("clamps to max when the buffer would exceed it", async () => {
    const user = userEvent.setup();
    // max = 3600 (1h)
    render(<Harness max={3600} />);
    const input = getInput();
    await user.type(input, "020000"); // 02:00:00 = 7200s, above max
    expect(input.value).toBe("01:00:00");
    expect(screen.getByTestId("value").textContent).toBe("3600");
  });

  it("ignores non-numeric characters", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "a,.-");
    expect(input.value).toBe("00:00:00");
    expect(screen.getByTestId("value").textContent).toBe("0");
  });

  it("Backspace removes the rightmost digit and shifts right", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "12545");
    expect(input.value).toBe("01:25:45");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:12:54");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:01:25");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:00:12");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:00:01");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:00:00");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:00:00");
  });

  it("paste extracts digits and feeds them through the shift register", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.click(input);
    await user.paste("01:02:03");
    // Buffer becomes "010203" (digits only) → display 01:02:03
    expect(input.value).toBe("01:02:03");
    expect(screen.getByTestId("value").textContent).toBe(String(1 * 3600 + 2 * 60 + 3));
  });

  it("paste containing no digits is a no-op", async () => {
    const user = userEvent.setup();
    render(<Harness initial={3600} />);
    const input = getInput();
    await user.click(input);
    await user.paste("abc");
    expect(input.value).toBe("01:00:00");
  });

  it("paste clamps to max", async () => {
    const user = userEvent.setup();
    render(<Harness max={3600} />);
    const input = getInput();
    await user.click(input);
    await user.paste("020000"); // 7200s > 3600s
    expect(input.value).toBe("01:00:00");
    expect(screen.getByTestId("value").textContent).toBe("3600");
  });

  it("uses type=text and inputMode=numeric (mobile numeric keyboard)", () => {
    render(<Harness />);
    const input = getInput();
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("inputMode")).toBe("numeric");
  });

  it("forwards aria-invalid to the underlying input", () => {
    const { rerender } = render(
      <SecondsInput value={0} onChange={() => {}} aria-invalid aria-label="d" />,
    );
    expect((screen.getByLabelText(/d/i) as HTMLInputElement).getAttribute("aria-invalid")).toBe(
      "true",
    );
    rerender(<SecondsInput value={0} onChange={() => {}} aria-label="d" />);
    expect((screen.getByLabelText(/d/i) as HTMLInputElement).getAttribute("aria-invalid")).toBe(
      null,
    );
  });

  it("is disabled when disabled prop is true", () => {
    render(<SecondsInput value={3600} onChange={() => {}} disabled aria-label="d" />);
    expect((screen.getByLabelText(/d/i) as HTMLInputElement).disabled).toBe(true);
  });
});
