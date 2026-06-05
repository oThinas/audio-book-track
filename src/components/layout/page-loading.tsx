/**
 * Accessible loading announcement region. Rendered exactly once per
 * route loading state so screen readers announce navigation feedback
 * a single time (FR-008).
 */
export function LoadingStatus() {
  return (
    <div role="status" data-testid="page-loading-status">
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
