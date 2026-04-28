"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ApiErrorBody } from "@/lib/api/error-response";
import type { Studio } from "@/lib/domain/studio";
import { type UpdateBookInput, updateBookSchema } from "@/lib/schemas/book";
import { cn, formatCentsBRL } from "@/lib/utils";

import { ChapterCountInput } from "./chapter-count-input";

const PRICE_PER_HOUR_MIN_CENTS = 1;
const PRICE_PER_HOUR_MAX_CENTS = 999_999;
const NUM_CHAPTERS_MAX = 999;

export interface BookEditValues {
  readonly id: string;
  readonly title: string;
  readonly studioId: string;
  readonly pricePerHourCents: number;
  readonly currentChapters: number;
  readonly hasPaidChapter: boolean;
}

export interface UpdatedBookDetail {
  readonly id: string;
  readonly title: string;
  readonly studio: { readonly id: string; readonly name: string };
  readonly pricePerHourCents: number;
  readonly status: import("@/lib/domain/book").BookStatus;
  readonly chapters: ReadonlyArray<{
    readonly id: string;
    readonly number: number;
    readonly status: import("@/lib/domain/chapter").ChapterStatus;
    readonly narrator: { readonly id: string; readonly name: string } | null;
    readonly editor: { readonly id: string; readonly name: string } | null;
    readonly editedSeconds: number;
  }>;
}

interface BookEditDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly book: BookEditValues;
  readonly studios: readonly Studio[];
  readonly onUpdated: (detail: UpdatedBookDetail) => void;
}

export function BookEditDialog({
  open,
  onOpenChange,
  book,
  studios,
  onUpdated,
}: BookEditDialogProps) {
  const [studioPickerOpen, setStudioPickerOpen] = useState(false);
  const [reduceHint, setReduceHint] = useState(false);

  const sortedStudios = useMemo(
    () => [...studios].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [studios],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty, isValid },
    setError,
    watch,
  } = useForm<UpdateBookInput>({
    resolver: zodResolver(updateBookSchema),
    mode: "onChange",
    // `values` (not `defaultValues`) keeps the form synced with the latest
    // book prop after `router.refresh()`. RHF re-seeds whenever any field
    // here changes, no useEffect needed.
    values: {
      title: book.title,
      studioId: book.studioId,
      pricePerHourCents: book.pricePerHourCents,
      numChapters: book.currentChapters,
    },
  });

  const selectedStudioId = watch("studioId");
  const selectedStudio = sortedStudios.find((s) => s.id === selectedStudioId);

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
      setStudioPickerOpen(false);
      setReduceHint(false);
    }
    onOpenChange(next);
  }

  async function onSubmit(values: UpdateBookInput) {
    const patch: UpdateBookInput = {};
    if (values.title !== undefined && values.title.trim() !== book.title) {
      patch.title = values.title.trim();
    }
    if (values.studioId !== undefined && values.studioId !== book.studioId) {
      patch.studioId = values.studioId;
    }
    if (
      values.pricePerHourCents !== undefined &&
      values.pricePerHourCents !== book.pricePerHourCents
    ) {
      patch.pricePerHourCents = values.pricePerHourCents;
    }
    if (values.numChapters !== undefined && values.numChapters !== book.currentChapters) {
      patch.numChapters = values.numChapters;
    }

    if (Object.keys(patch).length === 0) {
      handleOpenChange(false);
      return;
    }

    const response = await fetch(`/api/v1/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (response.status === 200) {
      const body = (await response.json()) as { data: UpdatedBookDetail };
      onUpdated(body.data);
      handleOpenChange(false);
      toast.success("Livro atualizado.");
      return;
    }

    if (response.status === 422) {
      const body = (await response.json()) as ApiErrorBody;
      if (body.error.code === "CANNOT_REDUCE_CHAPTERS") {
        setError("numChapters", {
          message: "Para reduzir a quantidade, use 'Excluir capítulos'.",
        });
        return;
      }
      if (body.error.code === "STUDIO_NOT_FOUND") {
        setError("studioId", { message: "Estúdio não encontrado ou arquivado." });
        return;
      }
      for (const detail of body.error.details ?? []) {
        if (detail.field && detail.field in values) {
          setError(detail.field as keyof UpdateBookInput, { message: detail.message });
        }
      }
      return;
    }

    if (response.status === 409) {
      const body = (await response.json()) as ApiErrorBody;
      switch (body.error.code) {
        case "TITLE_ALREADY_IN_USE":
          setError("title", {
            message: "Já existe um livro com este título neste estúdio.",
          });
          return;
        case "BOOK_PAID_PRICE_LOCKED":
          setError("pricePerHourCents", {
            message: "Valor/hora não pode ser alterado: já há capítulo pago.",
          });
          return;
        case "BOOK_PAID_STUDIO_LOCKED":
          setError("studioId", {
            message: "Estúdio não pode ser alterado: já há capítulo pago.",
          });
          return;
        default:
          break;
      }
    }

    toast.error("Não foi possível atualizar o livro. Tente novamente.");
  }

  const studioDisabled = book.hasPaidChapter;
  const priceDisabled = book.hasPaidChapter;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="book-edit-dialog">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>Editar livro</DialogTitle>
            <DialogDescription>
              Atualize título, estúdio, valor/hora ou aumente a quantidade de capítulos.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="mt-4">
            <Field data-invalid={errors.title ? true : undefined}>
              <FieldLabel htmlFor="book-edit-title">Título</FieldLabel>
              <Input
                id="book-edit-title"
                placeholder="Dom Casmurro"
                autoComplete="off"
                aria-invalid={errors.title ? true : undefined}
                disabled={isSubmitting}
                {...register("title")}
              />
              <FieldError>{errors.title?.message}</FieldError>
            </Field>

            <Field data-invalid={errors.studioId ? true : undefined}>
              <FieldLabel htmlFor="book-edit-studio">Estúdio</FieldLabel>
              <Controller
                name="studioId"
                control={control}
                render={({ field }) => (
                  <TooltipProvider>
                    <Tooltip>
                      <Popover open={studioPickerOpen} onOpenChange={setStudioPickerOpen}>
                        <TooltipTrigger
                          render={
                            <PopoverTrigger
                              render={
                                <Button
                                  id="book-edit-studio"
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={studioPickerOpen}
                                  aria-invalid={errors.studioId ? true : undefined}
                                  disabled={isSubmitting || studioDisabled}
                                  data-testid="book-edit-studio-trigger"
                                  className={cn(
                                    "w-full justify-between font-normal",
                                    !selectedStudio && "text-muted-foreground",
                                  )}
                                >
                                  {selectedStudio ? selectedStudio.name : "Selecione um estúdio"}
                                  <ChevronsUpDown
                                    aria-hidden="true"
                                    className="ml-2 size-4 shrink-0 opacity-50"
                                  />
                                </Button>
                              }
                            />
                          }
                        />
                        {studioDisabled && (
                          <TooltipContent>
                            Estúdio bloqueado: o livro tem capítulo pago.
                          </TooltipContent>
                        )}
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0"
                          align="start"
                        >
                          <Command>
                            <CommandInput placeholder="Buscar estúdio..." />
                            <CommandList>
                              <CommandEmpty>Nenhum estúdio encontrado.</CommandEmpty>
                              <CommandGroup>
                                {sortedStudios.map((studio) => (
                                  <CommandItem
                                    key={studio.id}
                                    value={studio.name}
                                    onSelect={() => {
                                      field.onChange(studio.id);
                                      setStudioPickerOpen(false);
                                    }}
                                    data-checked={field.value === studio.id ? true : undefined}
                                    data-testid={`book-edit-studio-item-${studio.id}`}
                                  >
                                    <div className="flex flex-col">
                                      <span>{studio.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatCentsBRL(studio.defaultHourlyRateCents)}/h
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </Tooltip>
                  </TooltipProvider>
                )}
              />
              <FieldError>{errors.studioId?.message}</FieldError>
            </Field>

            <div className="grid grid-cols-[auto_1fr] gap-4">
              <Field data-invalid={errors.pricePerHourCents ? true : undefined}>
                <FieldLabel htmlFor="book-edit-price">Valor/hora</FieldLabel>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Controller
                          name="pricePerHourCents"
                          control={control}
                          render={({ field }) => (
                            <MoneyInput
                              id="book-edit-price"
                              value={field.value ?? 0}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              min={PRICE_PER_HOUR_MIN_CENTS}
                              max={PRICE_PER_HOUR_MAX_CENTS}
                              disabled={isSubmitting || priceDisabled}
                              aria-invalid={errors.pricePerHourCents ? true : undefined}
                              data-testid="book-edit-price-input"
                            />
                          )}
                        />
                      }
                    />
                    {priceDisabled && (
                      <TooltipContent>
                        Valor/hora bloqueado: o livro tem capítulo pago.
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                <FieldError>{errors.pricePerHourCents?.message}</FieldError>
              </Field>

              <Field data-invalid={errors.numChapters ? true : undefined}>
                <FieldLabel htmlFor="book-edit-chapters">Capítulos</FieldLabel>
                <Controller
                  name="numChapters"
                  control={control}
                  render={({ field }) => (
                    <ChapterCountInput
                      id="book-edit-chapters"
                      value={field.value ?? book.currentChapters}
                      onChange={(next) => {
                        if (next < book.currentChapters) {
                          setReduceHint(true);
                          field.onChange(book.currentChapters);
                          return;
                        }
                        setReduceHint(false);
                        field.onChange(next);
                      }}
                      min={book.currentChapters}
                      max={NUM_CHAPTERS_MAX}
                      disabled={isSubmitting}
                      aria-invalid={errors.numChapters ? true : undefined}
                    />
                  )}
                />
                {reduceHint && (
                  <p
                    className="mt-1 text-xs text-muted-foreground"
                    data-testid="book-edit-chapters-reduce-hint"
                  >
                    Para reduzir, use &quot;Excluir capítulos&quot;.
                  </p>
                )}
                <FieldError>{errors.numChapters?.message}</FieldError>
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isDirty || !isValid}
              data-testid="book-edit-submit"
            >
              {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
