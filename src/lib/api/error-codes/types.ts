export interface ErrorCatalogEntry {
  readonly status: number;
  readonly message: string;
  readonly variant?: "error" | "warning";
}
