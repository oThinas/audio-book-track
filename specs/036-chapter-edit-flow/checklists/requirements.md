# Specification Quality Checklist: Chapter Edit Flow — Keyboard Save & Flexible Status

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-06-17
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Resolved through a `/grill-me` interview before drafting. Key decisions:
  - Request #2 is full-stack (UI mirror + domain state machine + service) plus a **constitution amendment** — relaxing only the UI would produce 422 errors on save (server is the source of truth).
  - "Pago" keeps narrow edges (enter only from "Concluído"; leave only to "Concluído" with confirmation); financial immutability untouched.
  - "Concluído" **and** "Pago" require narrator + editor + minutagem (> 0); all other (non-paid) statuses require no fields and allow free movement.
  - Missing required fields are surfaced on **Save** (FR-014), not by disabling options — consistent with current submit-time guard pattern.
  - Enter-to-save and Esc-to-cancel are **open-aware** (open popover acts first; nothing open → save/cancel).
- **FR-018** is a governance dependency: the constitution amendment touches the financial model and requires double review. Plan/implement must sequence the amendment (`/speckit-constitution`) before or alongside the domain change.
- One flagged assumption to confirm at plan time: "Retake" becomes reachable from any non-paid status (including "Pendente").
