import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://mock",
    BETTER_AUTH_SECRET: "mock-secret",
    BETTER_AUTH_URL: "http://localhost:1197",
    NODE_ENV: "test",
  },
}));
