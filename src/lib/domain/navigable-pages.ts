import type { FavoritePage } from "./user-preference";

interface NavigablePage {
  readonly slug: FavoritePage;
  readonly url: string;
  readonly label: string;
}

export const NAVIGABLE_PAGES: readonly NavigablePage[] = [
  { slug: "dashboard", url: "/dashboard", label: "Dashboard" },
  { slug: "books", url: "/books", label: "Livros" },
  { slug: "studios", url: "/studios", label: "Estúdios" },
  { slug: "editors", url: "/editors", label: "Editores" },
  { slug: "narrators", url: "/narrators", label: "Gravadores" },
  { slug: "settings", url: "/settings", label: "Configurações" },
] as const;

export const NAVIGABLE_PAGES_MAP = new Map(NAVIGABLE_PAGES.map((page) => [page.slug, page]));

export function getPageUrl(slug: FavoritePage): string {
  return NAVIGABLE_PAGES_MAP.get(slug)?.url ?? "/dashboard";
}
