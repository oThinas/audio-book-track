import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContextStore {
  readonly requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getCurrentRequestId(): string | null {
  return requestContext.getStore()?.requestId ?? null;
}
