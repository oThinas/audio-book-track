import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { ptBrZodErrorMap } from "@/lib/schemas/zod-error-map";

beforeAll(() => {
  z.config({ customError: ptBrZodErrorMap });
});

function firstMessage(result: z.ZodSafeParseResult<unknown>): string {
  if (result.success) throw new Error("expected validation to fail");
  const issue = result.error.issues[0];
  if (!issue) throw new Error("expected at least one issue");
  return issue.message;
}

describe("ptBrZodErrorMap — Zod default issues translated to PT-BR", () => {
  it("invalid_type for missing string → 'Campo obrigatório.' family (PT)", () => {
    const message = firstMessage(z.string().safeParse(undefined));
    expect(message).toMatch(/obrigat[óo]rio|campo|deve|valor/i);
    expect(message).not.toMatch(/^Required$|^Invalid input/);
    expect(message).not.toMatch(/Required|Invalid input|Expected/);
  });

  it("invalid_type for wrong type → PT message (não 'Expected string')", () => {
    const message = firstMessage(z.string().safeParse(42));
    expect(message).not.toMatch(/Expected\s+\w+|Required/);
    expect(message).toMatch(/inv[áa]lido|deve ser|texto|esperado/i);
  });

  it("too_small for number below min → mensagem PT-BR", () => {
    const message = firstMessage(z.number().min(10).safeParse(5));
    expect(message).not.toMatch(/Number must be|too small/i);
    expect(message).toMatch(/m[ií]nimo|menor|inv[áa]lido|pequeno/i);
  });

  it("too_big for string above max → mensagem PT-BR", () => {
    const message = firstMessage(z.string().max(3).safeParse("longo demais"));
    expect(message).not.toMatch(/String must contain|too large|too big/i);
    expect(message).toMatch(/m[áa]ximo|maior|caracter|inv[áa]lido|grande/i);
  });

  it("invalid email → mensagem PT-BR", () => {
    const message = firstMessage(z.email().safeParse("not-an-email"));
    expect(message).not.toMatch(/Invalid email|Invalid string/i);
    expect(message).toMatch(/e-?mail|inv[áa]lido/i);
  });

  it("invalid url → mensagem PT-BR", () => {
    const message = firstMessage(z.url().safeParse("not-a-url"));
    expect(message).not.toMatch(/Invalid url|Invalid string/i);
    expect(message).toMatch(/url|endere[çc]o|inv[áa]lido/i);
  });

  it("invalid uuid → mensagem PT-BR", () => {
    const message = firstMessage(z.uuid().safeParse("not-a-uuid"));
    expect(message).not.toMatch(/Invalid uuid/i);
    expect(message).toMatch(/uuid|identificador|inv[áa]lido/i);
  });

  it("enum mismatch → mensagem PT-BR", () => {
    const message = firstMessage(z.enum(["a", "b"]).safeParse("c"));
    expect(message).not.toMatch(/Invalid enum value|Expected/);
    expect(message).toMatch(/inv[áa]lido|valor|op[çc][ãa]o/i);
  });

  it("invalid_type for boolean → mensagem PT-BR", () => {
    const message = firstMessage(z.boolean().safeParse("true"));
    expect(message).not.toMatch(/Expected boolean/i);
    expect(message).toMatch(/inv[áa]lido|deve ser|booleano|verdadeiro|esperado/i);
  });
});
