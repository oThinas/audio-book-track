import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContextStore {
  readonly requestId: string;
  readonly userId: string | null;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getCurrentRequestId(): string | null {
  return requestContext.getStore()?.requestId ?? null;
}

export function getCurrentUserId(): string | null {
  const store = requestContext.getStore();
  if (!store) return null;
  return store.userId;
}
