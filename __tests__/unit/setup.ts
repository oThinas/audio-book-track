import { vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://mock",
    BETTER_AUTH_SECRET: "mock-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));
