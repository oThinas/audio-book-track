import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SEED_TEST_PATH = resolve(__dirname, "../../../src/lib/db/seed-test.ts");
const source = readFileSync(SEED_TEST_PATH, "utf-8");

// Patterns that would indicate seed-test touching domain tables. The ban is
// enforced via drizzle access (schema.xxx) and raw SQL quoting ("xxx").
const FORBIDDEN_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: "schema.userPreference", pattern: /\bschema\.userPreference\b/ },
  { label: 'SQL identifier "user_preference"', pattern: /"user_preference"/ },
  { label: "schema.studio", pattern: /\bschema\.studio\b/ },
  { label: 'SQL identifier "studio"', pattern: /"studio"/ },
  { label: "schema.book", pattern: /\bschema\.book\b/ },
  { label: 'SQL identifier "book"', pattern: /"book"/ },
  { label: "schema.chapter", pattern: /\bschema\.chapter\b/ },
  { label: 'SQL identifier "chapter"', pattern: /"chapter"/ },
  { label: "schema.narrator", pattern: /\bschema\.narrator\b/ },
  { label: 'SQL identifier "narrator"', pattern: /"narrator"/ },
  { label: "schema.editor", pattern: /\bschema\.editor\b/ },
  { label: 'SQL identifier "editor"', pattern: /"editor"/ },
];

describe("seed-test scope", () => {
  it("only creates the admin user — no domain tables referenced", () => {
    for (const { label, pattern } of FORBIDDEN_PATTERNS) {
      expect(
        pattern.test(source),
        `seed-test.ts must not touch domain data via ${label}. Use factories (see __tests__/helpers/factories.ts) instead.`,
      ).toBe(false);
    }
  });

  it("uses the fixed admin email to stay idempotent", () => {
    expect(source).toContain("admin@audiobook.local");
  });

  it("is idempotent via findFirst guard before insert", () => {
    expect(source).toMatch(/findFirst[\s\S]*?admin@audiobook\.local/);
  });
});
