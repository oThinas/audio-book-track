"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ApiErrorBody } from "@/lib/api/error-response";

const PDF_URL_MAX_LENGTH = 2048;

// Schema reflete updateBookSchema.pdfUrl no servidor: aceita string vazia
// (=> traduzida em null no submit) ou http(s) com no máximo 2048 chars.
const pdfUrlFormSchema = z.object({
  pdfUrl: z
    .string()
    .trim()
    .max(PDF_URL_MAX_LENGTH, `URL deve ter no máximo ${PDF_URL_MAX_LENGTH} caracteres`)
    .refine((value) => value === "" || /^https?:\/\//i.test(value), {
      message: "URL deve começar com http:// ou https://",
    }),
});

type PdfUrlFormValues = z.infer<typeof pdfUrlFormSchema>;

export interface BookPdfPopoverProps {
  readonly bookId: string;
  readonly pdfUrl: string | null;
  readonly onUpdated: (next: string | null) => void;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

export function BookPdfPopover({
  bookId,
  pdfUrl,
  onUpdated,
  open: controlledOpen,
  onOpenChange,
}: BookPdfPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty, isValid },
  } = useForm<PdfUrlFormValues>({
    resolver: zodResolver(pdfUrlFormSchema),
    mode: "onChange",
    defaultValues: { pdfUrl: pdfUrl ?? "" },
  });

  const watchedUrl = watch("pdfUrl");
  const draft = watchedUrl?.trim() ?? "";
  const isCleared = draft === "";
  const persistedUrl = pdfUrl ?? "";
  const hasPersistedChange = draft !== persistedUrl;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      // Sempre que abrir, sincroniza o form com o valor persistido.
      reset({ pdfUrl: pdfUrl ?? "" });
    }
    if (!isControlled) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  async function onSubmit(values: PdfUrlFormValues) {
    const trimmed = values.pdfUrl.trim();
    const payload: { pdfUrl: string | null } =
      trimmed === "" ? { pdfUrl: null } : { pdfUrl: trimmed };
    const response = await fetch(`/api/v1/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 200) {
      const next = trimmed === "" ? null : trimmed;
      onUpdated(next);
      handleOpenChange(false);
      toast.success(next === null ? "URL do PDF removida." : "URL do PDF salva.");
      return;
    }

    if (response.status === 422) {
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      const fieldError = body?.error.details?.find((d) => d.field === "pdfUrl");
      setError("pdfUrl", { message: fieldError?.message ?? "URL inválida." });
      return;
    }

    toast.error("Não foi possível salvar a URL. Tente novamente.");
  }

  const canSubmit = isValid && (isDirty || hasPersistedChange) && !isSubmitting;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="book-pdf-trigger"
            aria-label={pdfUrl ? "Editar URL do PDF" : "Adicionar URL do PDF"}
          >
            <FileText aria-hidden="true" className="size-4" />
            Ver PDF
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80" data-testid="book-pdf-popover">
        <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="book-pdf-url-input" className="text-sm font-medium">
              URL do PDF
            </Label>
            <Input
              id="book-pdf-url-input"
              type="url"
              inputMode="url"
              placeholder="https://exemplo.com/livro.pdf"
              aria-invalid={errors.pdfUrl ? true : undefined}
              data-testid="book-pdf-url-input"
              disabled={isSubmitting}
              {...register("pdfUrl")}
            />
            {errors.pdfUrl && (
              <p className="text-xs text-destructive" data-testid="book-pdf-url-error">
                {errors.pdfUrl.message}
              </p>
            )}
            {pdfUrl && isCleared && !errors.pdfUrl && (
              <p className="text-xs text-muted-foreground">
                Salvar com o campo vazio remove a URL.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="book-pdf-open-link"
                className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground transition-colors hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
                Abrir em nova guia
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">Nenhum PDF salvo.</span>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              data-testid="book-pdf-save-button"
            >
              {isSubmitting ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
