---
name: No null assertions for env vars
description: Use Zod validation for environment variables at startup instead of TypeScript non-null assertions (!)
type: feedback
---

Never use `!` (non-null assertion) for environment variables like `process.env.DATABASE_URL!`. Instead, use Zod to validate all env vars at project initialization, ensuring they are declared and typed correctly.

**Why:** The user considers non-null assertions unsafe — they bypass type checking. Zod validation at startup provides runtime guarantees and clear error messages.

**How to apply:** Whenever accessing `process.env`, import from a validated env module (e.g., `src/lib/env.ts`) that uses Zod to parse and export typed env vars.