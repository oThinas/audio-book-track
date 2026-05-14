export type FocusWeekState = "week" | null;

export function parseFocusParam(searchParams: URLSearchParams): FocusWeekState {
  const raw = searchParams.get("focus");
  return raw === "week" ? "week" : null;
}

export function serializeFocusParam(value: FocusWeekState): string | null {
  return value === "week" ? "week" : null;
}
