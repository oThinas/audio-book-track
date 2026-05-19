import { DomainError } from "./domain-error";

export class DashboardInvalidPeriodError extends DomainError {
  readonly code = "DASHBOARD_INVALID_PERIOD";
  constructor(
    readonly field: string,
    readonly reason: string,
  ) {
    super("Dashboard period is invalid");
    this.name = "DashboardInvalidPeriodError";
  }

  getDetails(): ReadonlyArray<{ field: string; message: string }> {
    return [{ field: this.field, message: this.reason }];
  }
}

export class DashboardWidgetsInvalidKeyError extends DomainError {
  readonly code = "DASHBOARD_WIDGETS_INVALID_KEY";
  constructor(readonly invalidKey: string) {
    super("Unknown dashboard widget key");
    this.name = "DashboardWidgetsInvalidKeyError";
  }

  getDetails(): ReadonlyArray<{ field: string; message: string }> {
    return [{ field: "widgets", message: `Chave desconhecida: ${this.invalidKey}` }];
  }
}
