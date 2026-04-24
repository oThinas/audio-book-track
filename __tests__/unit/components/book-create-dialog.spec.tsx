// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BookCreateDialog } from "@/components/features/books/book-create-dialog";
import type { Studio } from "@/lib/domain/studio";

function makeStudio(overrides: Partial<Studio> = {}): Studio {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    name: "Sonora",
    defaultHourlyRateCents: 8500,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function renderDialog(studios: Studio[]) {
  const onCreated = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <BookCreateDialog open onOpenChange={onOpenChange} studios={studios} onCreated={onCreated} />,
  );
  return { onCreated, onOpenChange };
}

function getPriceInput(): HTMLInputElement {
  return screen.getByLabelText(/valor\/hora/i) as HTMLInputElement;
}

async function selectStudio(name: string | RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: /estúdio/i }));
  const option = await screen.findByRole("option", { name });
  await user.click(option);
}

describe("BookCreateDialog — studio-driven price pre-fill", () => {
  it("pre-fills Valor/hora from studio.defaultHourlyRateCents when the price field is pristine", async () => {
    const studio = makeStudio({ name: "Sonora", defaultHourlyRateCents: 8500 });
    renderDialog([studio]);

    expect(getPriceInput().value).toMatch(/R\$\s*0,00/);

    await selectStudio(/sonora/i);

    expect(getPriceInput().value).toMatch(/R\$\s*85,00/);
  });

  it("does NOT overwrite the price when the user has already typed a value", async () => {
    const studio = makeStudio({ name: "Sonora", defaultHourlyRateCents: 8500 });
    renderDialog([studio]);

    const user = userEvent.setup();
    const priceInput = getPriceInput();
    await user.click(priceInput);
    await user.keyboard("6000");
    expect(priceInput.value).toMatch(/R\$\s*60,00/);

    await selectStudio(/sonora/i);

    expect(getPriceInput().value).toMatch(/R\$\s*60,00/);
  });

  it("updates the price when switching studios while the field is still pristine", async () => {
    const sonora = makeStudio({ name: "Sonora", defaultHourlyRateCents: 8500 });
    const outro = makeStudio({ name: "Outro Estúdio", defaultHourlyRateCents: 12000 });
    renderDialog([sonora, outro]);

    await selectStudio(/sonora/i);
    expect(getPriceInput().value).toMatch(/R\$\s*85,00/);

    await selectStudio(/outro estúdio/i);
    expect(getPriceInput().value).toMatch(/R\$\s*120,00/);
  });
});
