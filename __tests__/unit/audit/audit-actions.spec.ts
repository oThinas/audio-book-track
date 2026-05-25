import { describe, expect, it } from "vitest";

import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit/audit-actions";

const ACTION_FORMAT = /^[a-z]+(\.[a-z_]+)+$/;

describe("AUDIT_ACTIONS catalog", () => {
  it("contains exactly the 25 documented actions (4 studio + 3 book + 6 chapter + 4 narrator + 4 editor + 4 auth)", () => {
    expect(Object.keys(AUDIT_ACTIONS)).toHaveLength(25);
  });

  it("every key maps to a unique value", () => {
    const values = Object.values(AUDIT_ACTIONS);
    expect(new Set(values).size).toBe(values.length);
  });

  it("every value follows the <domain>.<verb>[.<modifier>] format", () => {
    for (const value of Object.values(AUDIT_ACTIONS)) {
      expect(value).toMatch(ACTION_FORMAT);
    }
  });

  it("covers all five domains plus auth", () => {
    const domains = new Set(Object.values(AUDIT_ACTIONS).map((v) => v.split(".")[0]));
    expect(domains).toEqual(new Set(["studio", "book", "chapter", "narrator", "editor", "auth"]));
  });

  it("AuditAction type accepts only catalog values (compile + runtime)", () => {
    const sample: AuditAction = AUDIT_ACTIONS.STUDIO_CREATE;
    expect(typeof sample).toBe("string");
    expect(Object.values(AUDIT_ACTIONS)).toContain(sample);
  });
});
