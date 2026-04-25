import type { BookStatus } from "@/lib/domain/book";

export const STATUS_LABELS: Record<BookStatus, string> = {
  pending: "Pendente",
  editing: "Em edição",
  reviewing: "Em revisão",
  retake: "Retake",
  completed: "Concluído",
  paid: "Pago",
};

export const STATUS_CLASSES: Record<BookStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  editing: "bg-editing/15 text-editing",
  reviewing: "bg-reviewing/15 text-reviewing",
  retake: "bg-retake/15 text-retake",
  completed: "bg-completed/15 text-completed",
  paid: "bg-primary/15 text-primary",
};

interface StatusBadgeProps {
  readonly status: BookStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
