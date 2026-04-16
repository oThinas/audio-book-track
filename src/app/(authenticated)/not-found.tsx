import { HeadphoneOff } from "lucide-react";

import { NOT_FOUND_MESSAGES } from "@/lib/constants/not-found-messages";

export default function NotFound() {
  const message = NOT_FOUND_MESSAGES[Math.floor(Math.random() * NOT_FOUND_MESSAGES.length)];

  return (
    <main className="flex flex-col items-center justify-center gap-6 px-6 h-screen text-center">
      <HeadphoneOff className="size-14 text-primary" />

      <h1 className="text-8xl font-extrabold tracking-tighter text-foreground sm:text-9xl">404</h1>

      <p
        data-testid="not-found-message"
        className="max-w-sm text-lg font-medium text-muted-foreground"
      >
        {message}
      </p>

      <p className="max-w-sm text-sm text-muted-foreground/70">
        A página que você procura não foi encontrada.
      </p>
    </main>
  );
}
