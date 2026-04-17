import { envSchema } from "./schema";

export { type Env, envSchema } from "./schema";

export const env = envSchema.parse(process.env);
