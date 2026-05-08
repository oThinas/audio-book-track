import { z } from "zod";

import { ptBrZodErrorMap } from "@/lib/schemas/zod-error-map";

/**
 * Side-effect import: registers the PT-BR error map as Zod's global custom error.
 *
 * Imported once at module load time by:
 * - `src/lib/api/with-error-handler.ts` — covers every authenticated v1 route.
 * - `__tests__/unit/setup.ts` and `__tests__/integration/setup.ts` — covers
 *   schemas exercised in tests that don't go through the wrapper.
 *
 * Schema-level messages (passed to `.min()`, `.email()`, etc.) always win;
 * this bootstrap only affects defaults that weren't given a project message.
 */
z.config({ customError: ptBrZodErrorMap });
