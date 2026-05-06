import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom lacks ResizeObserver; cmdk (Command) and other UI libs call it on mount.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom lacks Element.scrollIntoView; cmdk calls it when focusing the active item.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://mock",
    BETTER_AUTH_SECRET: "mock-secret",
    BETTER_AUTH_URL: "http://localhost:1197",
    NODE_ENV: "test",
  },
}));

// Canonical mock for next/navigation. Hooks consumed by client components
// (`useRouter`, `useSearchParams`, `usePathname`, `useParams`) and the imperative
// helpers (`redirect`, `notFound`) are stubbed with vi.fn() so renderHook tests
// don't need to redeclare them per spec. Individual specs can still override
// via their own `vi.mock("next/navigation", ...)` (file-local mocks win).
vi.mock("next/navigation", () => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    useRouter: vi.fn(() => router),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    usePathname: vi.fn(() => "/"),
    useParams: vi.fn(() => ({})),
    redirect: vi.fn((url: string) => {
      const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
      error.digest = `NEXT_REDIRECT;replace;${url};307;`;
      throw error;
    }),
    notFound: vi.fn(() => {
      const error = new Error("NEXT_NOT_FOUND") as Error & { digest: string };
      error.digest = "NEXT_NOT_FOUND";
      throw error;
    }),
  };
});
