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
  editing: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  reviewing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  retake: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
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
