import {
  formatViolationOutput,
  separateViolationsByImpact,
} from "@tests/e2e/helpers/accessibility";
import type { NodeResult, Result } from "axe-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("@axe-core/playwright", () => ({ default: vi.fn() }));

function createMockNode(overrides: Partial<NodeResult> = {}): NodeResult {
  return {
    html: '<button class="btn">Click me</button>',
    target: ["button.btn"],
    impact: "serious",
    failureSummary: "Fix any of the following:\n  Element has insufficient color contrast of 2.5:1",
    any: [],
    all: [],
    none: [],
    ...overrides,
  };
}

function createMockViolation(overrides: Partial<Result> = {}): Result {
  return {
    id: "color-contrast",
    impact: "serious",
    description:
      "Ensures the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
    help: "Elements must meet minimum color contrast ratio thresholds",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
    tags: ["wcag2aa", "wcag143"],
    nodes: [createMockNode()],
    ...overrides,
  };
}

describe("separateViolationsByImpact", () => {
  it("classifies critical violations as blocking", () => {
    const violations = [createMockViolation({ id: "aria-required-attr", impact: "critical" })];
    const result = separateViolationsByImpact(violations);

    expect(result.blocking).toHaveLength(1);
    expect(result.blocking[0].id).toBe("aria-required-attr");
    expect(result.warnings).toHaveLength(0);
  });

  it("classifies serious violations as blocking", () => {
    const violations = [createMockViolation({ id: "color-contrast", impact: "serious" })];
    const result = separateViolationsByImpact(violations);

    expect(result.blocking).toHaveLength(1);
    expect(result.blocking[0].id).toBe("color-contrast");
    expect(result.warnings).toHaveLength(0);
  });

  it("classifies moderate violations as warnings", () => {
    const violations = [createMockViolation({ id: "heading-order", impact: "moderate" })];
    const result = separateViolationsByImpact(violations);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].id).toBe("heading-order");
    expect(result.blocking).toHaveLength(0);
  });

  it("classifies minor violations as warnings", () => {
    const violations = [createMockViolation({ id: "region", impact: "minor" })];
    const result = separateViolationsByImpact(violations);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].id).toBe("region");
    expect(result.blocking).toHaveLength(0);
  });

  it("separates mixed violations correctly", () => {
    const violations = [
      createMockViolation({ id: "critical-rule", impact: "critical" }),
      createMockViolation({ id: "moderate-rule", impact: "moderate" }),
      createMockViolation({ id: "serious-rule", impact: "serious" }),
      createMockViolation({ id: "minor-rule", impact: "minor" }),
    ];
    const result = separateViolationsByImpact(violations);

    expect(result.blocking).toHaveLength(2);
    expect(result.warnings).toHaveLength(2);
    expect(result.blocking.map((v) => v.id)).toEqual(["critical-rule", "serious-rule"]);
    expect(result.warnings.map((v) => v.id)).toEqual(["moderate-rule", "minor-rule"]);
  });

  it("returns empty arrays when no violations exist", () => {
    const result = separateViolationsByImpact([]);

    expect(result.blocking).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("classifies violations with undefined impact as warnings", () => {
    const violations = [createMockViolation({ id: "unknown-rule", impact: undefined })];
    const result = separateViolationsByImpact(violations);

    expect(result.warnings).toHaveLength(1);
    expect(result.blocking).toHaveLength(0);
  });
});

describe("formatViolationOutput", () => {
  it("formats a single violation with rule details", () => {
    const violations = [
      createMockViolation({
        id: "color-contrast",
        impact: "serious",
        description: "Ensures contrast ratio meets thresholds",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
      }),
    ];
    const output = formatViolationOutput(violations);

    expect(output).toContain("color-contrast");
    expect(output).toContain("serious");
    expect(output).toContain("Ensures contrast ratio meets thresholds");
    expect(output).toContain("https://dequeuniversity.com/rules/axe/4.10/color-contrast");
  });

  it("includes affected elements in output", () => {
    const violations = [
      createMockViolation({
        nodes: [
          createMockNode({
            html: '<input type="text">',
            target: ["#username"],
            failureSummary: "Element does not have a label",
          }),
        ],
      }),
    ];
    const output = formatViolationOutput(violations);

    expect(output).toContain('<input type="text">');
    expect(output).toContain("#username");
    expect(output).toContain("Element does not have a label");
  });

  it("returns empty string for no violations", () => {
    const output = formatViolationOutput([]);

    expect(output).toBe("");
  });

  it("formats multiple violations", () => {
    const violations = [
      createMockViolation({ id: "rule-one", impact: "critical" }),
      createMockViolation({ id: "rule-two", impact: "moderate" }),
    ];
    const output = formatViolationOutput(violations);

    expect(output).toContain("rule-one");
    expect(output).toContain("rule-two");
  });

  it("formats violation with multiple affected nodes", () => {
    const violations = [
      createMockViolation({
        nodes: [
          createMockNode({ target: ["#first"], html: "<div>First</div>" }),
          createMockNode({ target: ["#second"], html: "<div>Second</div>" }),
        ],
      }),
    ];
    const output = formatViolationOutput(violations);

    expect(output).toContain("#first");
    expect(output).toContain("#second");
  });
});
