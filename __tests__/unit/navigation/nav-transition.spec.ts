import { describe, expect, it } from "vitest";

import { type NavTransitionType, resolveNavTransition } from "@/lib/navigation/nav-transition";

/**
 * Covers contract C1 (specs/038-page-view-transitions/contracts/ui-contracts.md).
 * The helper is pure and must NOT consult browser history (FR-017): the
 * direction is purely a function of the (fromPath, toPath) pair.
 */
describe("resolveNavTransition", () => {
  describe("depth (list <-> detail)", () => {
    it("returns depth-forward when toPath is a descendant of fromPath", () => {
      expect(resolveNavTransition("/books", "/books/123")).toBe("depth-forward");
    });

    it("returns depth-back when toPath is an ancestor of fromPath", () => {
      expect(resolveNavTransition("/books/123", "/books")).toBe("depth-back");
    });

    it("treats descendant by full segment, not string prefix", () => {
      // "/book" is a string prefix of "/books" but not a segment ancestor.
      expect(resolveNavTransition("/book", "/books")).toBe("none");
    });
  });

  describe("vertical axis (top-level menu order)", () => {
    const cases: ReadonlyArray<[string, string, NavTransitionType]> = [
      ["/dashboard", "/books", "nav-down"], // idx 0 -> 1
      ["/books", "/dashboard", "nav-up"], // idx 1 -> 0
      ["/dashboard", "/narrators", "nav-down"], // idx 0 -> 4
      ["/narrators", "/studios", "nav-up"], // idx 4 -> 2
      ["/books", "/narrators", "nav-down"], // idx 1 -> 4
    ];

    it.each(cases)("%s -> %s = %s", (from, to, expected) => {
      expect(resolveNavTransition(from, to)).toBe(expected);
    });
  });

  describe("none (unclassified / same route)", () => {
    const cases: ReadonlyArray<[string, string]> = [
      ["/books/123", "/studios"], // neither depth nor top-level siblings
      ["/books", "/books"], // same route
      ["/dashboard", "/settings"], // settings is BOTTOM_ITEMS, off the vertical axis
      ["/settings", "/dashboard"], // settings not in NAV_ITEMS
      ["/books/123", "/books/456"], // sibling details, not ancestor/descendant
      ["/dashboard", "/books/123"], // different roots, not a direct depth pair
    ];

    it.each(cases)("%s -> %s = none", (from, to) => {
      expect(resolveNavTransition(from, to)).toBe("none");
    });
  });
});
