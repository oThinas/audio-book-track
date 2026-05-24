import { initClientSentry } from "@/lib/sentry/client";

initClientSentry(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_APP_VERSION);
