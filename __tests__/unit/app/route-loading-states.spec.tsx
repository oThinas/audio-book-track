// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BooksLoading from "@/app/(authenticated)/books/loading";
import EditorsLoading from "@/app/(authenticated)/editors/loading";
import NarratorsLoading from "@/app/(authenticated)/narrators/loading";
import StudiosLoading from "@/app/(authenticated)/studios/loading";

const listingRoutes = [
  { route: "/books", Loading: BooksLoading, title: "Livros" },
  { route: "/narrators", Loading: NarratorsLoading, title: "Narradores" },
  { route: "/editors", Loading: EditorsLoading, title: "Editores" },
  { route: "/studios", Loading: StudiosLoading, title: "Estúdios" },
] as const;

describe.each(listingRoutes)("$route loading state", ({ Loading, title }) => {
  it("renders the real page title as a heading", () => {
    render(<Loading />);

    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
  });

  it("renders exactly one loading status announcement", () => {
    render(<Loading />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("renders a single aria-hidden skeleton block", () => {
    render(<Loading />);

    const blocks = screen.getAllByTestId("page-loading-skeleton");

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders a disabled action button", () => {
    render(<Loading />);

    const button = screen.getByRole("button");

    expect(button.hasAttribute("disabled")).toBe(true);
  });
});

describe("search field across listing loading states", () => {
  it("renders a disabled search input on /books only", () => {
    render(<BooksLoading />);

    const search = screen.getByRole("searchbox", { name: "Buscar livros" });

    expect(search.hasAttribute("disabled")).toBe(true);
  });

  it.each([
    ["/narrators", NarratorsLoading],
    ["/editors", EditorsLoading],
    ["/studios", StudiosLoading],
  ] as const)("omits the search input on %s", (_route, Loading) => {
    render(<Loading />);

    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
