import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Result } from "axe-core";

const THEMES = ["light", "dark"] as const;
const PRIMARY_COLORS = ["blue", "orange", "green", "red", "amber"] as const;

const BLOCKING_IMPACTS = new Set<string>(["critical", "serious"]);

export interface AccessibilityOptions {
  /** Page requires authentication — iterates 10 combinations (theme x color). Default: true */
  authenticated?: boolean;
  /** axe-core rule IDs to disable (e.g. third-party component issues) */
  disableRules?: string[];
}

export interface SeparatedViolations {
  blocking: Result[];
  warnings: Result[];
}

export function separateViolationsByImpact(violations: Result[]): SeparatedViolations {
  const blocking: Result[] = [];
  const warnings: Result[] = [];

  for (const violation of violations) {
    if (violation.impact && BLOCKING_IMPACTS.has(violation.impact)) {
      blocking.push(violation);
    } else {
      warnings.push(violation);
    }
  }

  return { blocking, warnings };
}

export function formatViolationOutput(violations: Result[]): string {
  if (violations.length === 0) return "";

  return violations
    .map((violation) => {
      const header = `[${violation.impact ?? "unknown"}] ${violation.id}: ${violation.description}`;
      const url = `  Help: ${violation.helpUrl}`;
      const nodes = violation.nodes
        .map(
          (node) =>
            `  - ${node.target.join(", ")}\n    HTML: ${node.html}${node.failureSummary ? `\n    ${node.failureSummary}` : ""}`,
        )
        .join("\n");
      return `${header}\n${url}\n${nodes}`;
    })
    .join("\n\n");
}

async function setTheme(page: Page, theme: string): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem("theme", t);
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, theme);
}

async function setPrimaryColor(page: Page, color: string): Promise<void> {
  await page.evaluate((c) => {
    document.documentElement.setAttribute("data-primary-color", c);
    localStorage.setItem("primary-color", c);
  }, color);
}

export async function checkAccessibility(
  page: Page,
  label: string,
  options: AccessibilityOptions = {},
): Promise<void> {
  const { authenticated = true, disableRules = [] } = options;

  const combinations: Array<{ theme: string; color?: string }> = [];

  if (authenticated) {
    for (const theme of THEMES) {
      for (const color of PRIMARY_COLORS) {
        combinations.push({ theme, color });
      }
    }
  } else {
    for (const theme of THEMES) {
      combinations.push({ theme });
    }
  }

  const allBlocking: Array<{ combo: string; violations: Result[] }> = [];

  for (const { theme, color } of combinations) {
    const comboLabel = color ? `${theme}/${color}` : theme;

    await setTheme(page, theme);
    if (color) {
      await setPrimaryColor(page, color);
    }
    await page.waitForTimeout(100);

    let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);

    if (disableRules.length > 0) {
      builder = builder.disableRules(disableRules);
    }

    const results = await builder.analyze();
    const { blocking, warnings } = separateViolationsByImpact(results.violations);

    if (warnings.length > 0) {
      console.warn(
        `[a11y] [${label}] ${comboLabel} — ${warnings.length} warning(s):\n${formatViolationOutput(warnings)}`,
      );
    }

    if (blocking.length > 0) {
      await page.screenshot({
        path: `test-results/a11y-${label}-${theme}${color ? `-${color}` : ""}-violation.png`,
        fullPage: true,
      });
      allBlocking.push({ combo: comboLabel, violations: blocking });
    }
  }

  if (allBlocking.length > 0) {
    const total = allBlocking.reduce((sum, entry) => sum + entry.violations.length, 0);
    const details = allBlocking
      .map(
        ({ combo, violations }) =>
          `\n--- ${combo} (${violations.length} blocking) ---\n${formatViolationOutput(violations)}`,
      )
      .join("\n");

    throw new Error(`[${label}] ${total} blocking accessibility violation(s) found:\n${details}`);
  }
}
