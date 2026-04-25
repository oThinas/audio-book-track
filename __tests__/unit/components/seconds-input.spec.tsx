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

describe("SecondsInput (seconds-first)", () => {
  it("renders the formatted HH:MM:SS value from the prop (controlled)", () => {
    render(<Harness initial={3661} />);
    expect(getInput().value).toBe("01:01:01");
  });

  it("initial zero value displays 00:00:00", () => {
    render(<Harness />);
    expect(getInput().value).toBe("00:00:00");
  });

  it("typing a single digit accumulates as seconds (8 → 00:00:08)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "8");
    expect(screen.getByTestId("value").textContent).toBe("8");
    expect(input.value).toBe("00:00:08");
  });

  it("typing a sequence (1,2,3,4,5) results in 03:25:45 (12345 seconds)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "12345");
    expect(screen.getByTestId("value").textContent).toBe("12345");
    expect(input.value).toBe("03:25:45");
  });

  it("typing 3600 yields 01:00:00 (one full hour)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "3600");
    expect(screen.getByTestId("value").textContent).toBe("3600");
    expect(input.value).toBe("01:00:00");
  });

  it("clamps to max when additional digits would exceed it", async () => {
    const user = userEvent.setup();
    render(<Harness max={3_600_000} />);
    const input = getInput();
    await user.type(input, "99999999");
    expect(screen.getByTestId("value").textContent).toBe("3600000");
    expect(input.value).toBe("1000:00:00");
  });

  it("ignores non-numeric characters", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "a,.-");
    expect(input.value).toBe("00:00:00");
    expect(screen.getByTestId("value").textContent).toBe("0");
  });

  it("Backspace removes the last accumulated digit", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.type(input, "12345");
    expect(input.value).toBe("03:25:45");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:20:34");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:02:03");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:00:12");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:00:01");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:00:00");
    await user.type(input, "{Backspace}");
    expect(input.value).toBe("00:00:00");
  });

  it("paste extracts digits and applies them in order (no max)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();
    await user.click(input);
    await user.paste("01:02:03");
    expect(screen.getByTestId("value").textContent).toBe("10203");
    expect(input.value).toBe("02:50:03");
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
    render(<Harness max={3_600_000} />);
    const input = getInput();
    await user.click(input);
    await user.paste("12345678");
    expect(screen.getByTestId("value").textContent).toBe("3600000");
    expect(input.value).toBe("1000:00:00");
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
