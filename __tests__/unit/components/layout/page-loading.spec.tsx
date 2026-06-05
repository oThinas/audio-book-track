// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ListPageLoading, LoadingStatus } from "@/components/layout/page-loading";

describe("LoadingStatus", () => {
  it("renders a status region with the page-loading-status testid", () => {
    render(<LoadingStatus />);

    const status = screen.getByRole("status");

    expect(status.getAttribute("data-testid")).toBe("page-loading-status");
  });

  it("announces loading exactly once via sr-only text", () => {
    render(<LoadingStatus />);

    const announcements = screen.getAllByText("Carregando…");

    expect(announcements).toHaveLength(1);
    expect(announcements[0]?.className).toContain("sr-only");
  });
});

describe("ListPageLoading", () => {
  const fullProps = {
    title: "Livros",
    description: "Acompanhe capítulos, ganhos e status por livro.",
    actionLabel: "Novo Livro",
    searchPlaceholder: "Buscar por título ou estúdio",
    searchLabel: "Buscar livros",
  };

  it("renders the real page title as a heading", () => {
    render(<ListPageLoading {...fullProps} />);

    expect(screen.getByRole("heading", { name: "Livros" })).toBeTruthy();
  });

  it("renders the real description when provided", () => {
    render(<ListPageLoading {...fullProps} />);

    expect(screen.getByText("Acompanhe capítulos, ganhos e status por livro.")).toBeTruthy();
  });

  it("renders a disabled action button when actionLabel is provided", () => {
    render(<ListPageLoading {...fullProps} />);

    const button = screen.getByRole("button", { name: "Novo Livro" });

    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("renders a disabled search input when search props are provided", () => {
    render(<ListPageLoading {...fullProps} />);

    const search = screen.getByRole("searchbox", { name: "Buscar livros" });

    expect(search.hasAttribute("disabled")).toBe(true);
    expect(search.getAttribute("placeholder")).toBe("Buscar por título ou estúdio");
  });

  it("renders a single aria-hidden skeleton block for the table region", () => {
    render(<ListPageLoading {...fullProps} />);

    const blocks = screen.getAllByTestId("page-loading-skeleton");

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders exactly one loading status announcement", () => {
    render(<ListPageLoading {...fullProps} />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("omits description, action button and search when optional props are absent", () => {
    render(<ListPageLoading title="Narradores" />);

    expect(screen.getByRole("heading", { name: "Narradores" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getAllByTestId("page-loading-skeleton")).toHaveLength(1);
  });
});
