import { getTestDb } from "@tests/helpers/db";
import { createTestBook } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";

import { DrizzleBookRepository } from "@/lib/repositories/drizzle/drizzle-book-repository";

function createRepo() {
  return new DrizzleBookRepository(getTestDb());
}

describe("DrizzleBookRepository — chapters_version", () => {
  it("nasce com chaptersVersion = 0", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    const fetched = await repo.findById(book.id);
    expect(fetched?.chaptersVersion).toBe(0);
  });

  it("bumpChaptersVersion incrementa em 1 e retorna o novo valor", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());

    const v1 = await repo.bumpChaptersVersion(book.id);
    expect(v1).toBe(1);

    const v2 = await repo.bumpChaptersVersion(book.id);
    expect(v2).toBe(2);

    const fetched = await repo.findById(book.id);
    expect(fetched?.chaptersVersion).toBe(2);
  });

  it("listSummaries continua funcionando após bump (versão é exposta no Book mas listSummaries não precisa retornar)", async () => {
    const repo = createRepo();
    const { book } = await createTestBook(getTestDb());
    await repo.bumpChaptersVersion(book.id);

    const summaries = await repo.listSummaries({
      todayIso: "2026-05-15",
      mondayIso: "2026-05-11",
      sundayIso: "2026-05-17",
    });
    expect(summaries.find((s) => s.id === book.id)).toBeDefined();
  });
});
