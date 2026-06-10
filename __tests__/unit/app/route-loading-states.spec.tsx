// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BooksLoading from "@/app/(authenticated)/books/(list)/loading";
import BookDetailLoading from "@/app/(authenticated)/books/[id]/loading";
import EditorsLoading from "@/app/(authenticated)/editors/loading";
import NarratorsLoading from "@/app/(authenticated)/narrators/loading";
import SettingsLoading from "@/app/(authenticated)/settings/loading";
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

describe("/settings loading state", () => {
  it("renders the real Configurações heading", () => {
    render(<SettingsLoading />);

    expect(screen.getByRole("heading", { name: "Configurações" })).toBeTruthy();
  });

  it("renders exactly one loading status announcement", () => {
    render(<SettingsLoading />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("renders two aria-hidden skeleton blocks (appearance card + widgets section)", () => {
    const { container } = render(<SettingsLoading />);

    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');

    expect(skeletons).toHaveLength(2);
    for (const skeleton of skeletons) {
      expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("renders a single skeleton block with the main region testid", () => {
    render(<SettingsLoading />);

    expect(screen.getAllByTestId("page-loading-skeleton")).toHaveLength(1);
  });
});

describe("/books/[id] loading state", () => {
  it("renders no textual heading since the title is dynamic", () => {
    render(<BookDetailLoading />);

    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders exactly one loading status announcement", () => {
    render(<BookDetailLoading />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("renders four aria-hidden skeletons (three header bars + one block)", () => {
    const { container } = render(<BookDetailLoading />);

    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');

    expect(skeletons).toHaveLength(4);
    for (const skeleton of skeletons) {
      expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("renders a single skeleton block for the chapters region", () => {
    render(<BookDetailLoading />);

    expect(screen.getAllByTestId("page-loading-skeleton")).toHaveLength(1);
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
