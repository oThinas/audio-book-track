type Navigator = (path: string) => void;

let navigator: Navigator | null = null;

export function registerNavigator(fn: Navigator): void {
  navigator = fn;
}

export function unregisterNavigator(): void {
  navigator = null;
}

export function navigateToLogin(): void {
  if (navigator) {
    navigator("/login");
    return;
  }
  if (typeof window !== "undefined") {
    window.location.replace("/login");
  }
}
