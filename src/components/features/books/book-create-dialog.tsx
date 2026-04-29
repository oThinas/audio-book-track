"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  CommandSeparator,
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
import type { ApiErrorBody } from "@/lib/api/error-response";
import type { Studio } from "@/lib/domain/studio";
import { type CreateBookInput, createBookSchema } from "@/lib/schemas/book";
import { cn, formatCentsBRL } from "@/lib/utils";

import { CHAPTER_COUNT_MAX, CHAPTER_COUNT_MIN, ChapterCountInput } from "./chapter-count-input";
import { StudioInlineCreator } from "./studio-inline-creator";

const PRICE_PER_HOUR_MIN_CENTS = 1;
const PRICE_PER_HOUR_MAX_CENTS = 999_999;

export interface CreatedBook {
  readonly id: string;
  readonly title: string;
  readonly studio: { readonly id: string; readonly name: string };
  readonly pricePerHourCents: number;
  readonly chapters: ReadonlyArray<{ readonly id: string; readonly number: number }>;
}

interface BookCreateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly studios: readonly Studio[];
  readonly onCreated: (book: CreatedBook) => void;
}

export function BookCreateDialog({
  open,
  onOpenChange,
  studios,
  onCreated,
}: BookCreateDialogProps) {
  const [studioPickerOpen, setStudioPickerOpen] = useState(false);
  const [showInlineCreator, setShowInlineCreator] = useState(false);
  const [inlineStudios, setInlineStudios] = useState<readonly Studio[]>([]);
  const [inlineStudioId, setInlineStudioId] = useState<string | null>(null);

  const sortedStudios = useMemo(() => {
    const merged = [...studios, ...inlineStudios];
    const seen = new Set<string>();
    const deduped: Studio[] = [];
    for (const s of merged) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      deduped.push(s);
    }
    return deduped.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [studios, inlineStudios]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid, dirtyFields },
    setError,
    setValue,
    watch,
  } = useForm<CreateBookInput>({
    resolver: zodResolver(createBookSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      studioId: "",
      pricePerHourCents: 0,
      numChapters: 1,
    },
  });

  const selectedStudioId = watch("studioId");
  const selectedStudio = sortedStudios.find((s) => s.id === selectedStudioId);

  // When the user picks a studio and hasn't typed a custom price yet, suggest
  // the studio's default hourly rate. The field stays pristine so a subsequent
  // studio switch still updates the suggestion; the first manual keystroke
  // marks it dirty and locks in the user's value.
  useEffect(() => {
    if (!selectedStudio) return;
    if (dirtyFields.pricePerHourCents) return;
    setValue("pricePerHourCents", selectedStudio.defaultHourlyRateCents, {
      shouldValidate: true,
      shouldDirty: false,
    });
  }, [selectedStudio, setValue, dirtyFields.pricePerHourCents]);

  function resetState() {
    reset();
    setStudioPickerOpen(false);
    setShowInlineCreator(false);
    setInlineStudios([]);
    setInlineStudioId(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (inlineStudioId) {
        toast.warning(
          "Estúdio criado mas não vinculado: o valor/hora ficou em R$ 0,01. Edite-o quando puder.",
        );
      }
      resetState();
    }
    onOpenChange(next);
  }

  function handleInlineStudioCreated(studio: Studio) {
    setInlineStudios((current) => [...current, studio]);
    setInlineStudioId(studio.id);
    setValue("studioId", studio.id, { shouldValidate: true, shouldDirty: true });
    setShowInlineCreator(false);
    setStudioPickerOpen(false);
  }

  async function onSubmit(values: CreateBookInput) {
    const payload =
      inlineStudioId && inlineStudioId === values.studioId ? { ...values, inlineStudioId } : values;
    const response = await fetch("/api/v1/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 201) {
      const body = (await response.json()) as {
        data: {
          readonly id: string;
          readonly title: string;
          readonly studioId: string;
          readonly pricePerHourCents: number;
          readonly chapters: ReadonlyArray<{ readonly id: string; readonly number: number }>;
        };
      };
      const studio = sortedStudios.find((s) => s.id === body.data.studioId);
      const created: CreatedBook = {
        id: body.data.id,
        title: body.data.title,
        studio: { id: body.data.studioId, name: studio?.name ?? "" },
        pricePerHourCents: body.data.pricePerHourCents,
        chapters: body.data.chapters,
      };
      resetState();
      onCreated(created);
      return;
    }

    if (response.status === 422) {
      const body = (await response.json()) as ApiErrorBody;
      if (body.error.code === "STUDIO_NOT_FOUND") {
        setError("studioId", { message: "Estúdio não encontrado ou arquivado." });
        return;
      }
      if (body.error.code === "INLINE_STUDIO_INVALID") {
        setError("studioId", {
          message: "Estúdio inline inválido. Selecione outro estúdio.",
        });
        return;
      }
      for (const detail of body.error.details ?? []) {
        if (detail.field && detail.field in values) {
          setError(detail.field as keyof CreateBookInput, { message: detail.message });
        }
      }
      return;
    }

    if (response.status === 409) {
      setError("title", { message: "Já existe um livro com este título neste estúdio." });
      return;
    }

    toast.error("Não foi possível criar o livro. Tente novamente.");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="book-create-dialog">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>Novo Livro</DialogTitle>
            <DialogDescription>
              Cadastre um novo livro com sua quantidade inicial de capítulos.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="mt-4">
            <Field data-invalid={errors.title ? true : undefined}>
              <FieldLabel htmlFor="book-title">Título</FieldLabel>
              <Input
                id="book-title"
                placeholder="Dom Casmurro"
                autoComplete="off"
                aria-invalid={errors.title ? true : undefined}
                disabled={isSubmitting}
                {...register("title")}
              />
              <FieldError>{errors.title?.message}</FieldError>
            </Field>

            <Field data-invalid={errors.studioId ? true : undefined}>
              <FieldLabel htmlFor="book-studio">Estúdio</FieldLabel>
              <Controller
                name="studioId"
                control={control}
                render={({ field }) => (
                  <Popover open={studioPickerOpen} onOpenChange={setStudioPickerOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          id="book-studio"
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={studioPickerOpen}
                          aria-invalid={errors.studioId ? true : undefined}
                          disabled={isSubmitting}
                          data-testid="book-studio-trigger"
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
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      {showInlineCreator ? (
                        <StudioInlineCreator
                          onCreated={handleInlineStudioCreated}
                          onCancel={() => setShowInlineCreator(false)}
                        />
                      ) : (
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
                                  data-testid={`book-studio-item-${studio.id}`}
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
                            <CommandSeparator />
                            <CommandGroup>
                              <CommandItem
                                value="__inline_create_studio__"
                                onSelect={() => setShowInlineCreator(true)}
                                data-testid="book-studio-inline-create"
                                className="text-primary"
                              >
                                <Plus aria-hidden="true" className="mr-2 size-4" />
                                Novo Estúdio
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      )}
                    </PopoverContent>
                  </Popover>
                )}
              />
              <FieldError>{errors.studioId?.message}</FieldError>
            </Field>

            <div className="grid grid-cols-[auto_1fr] gap-4">
              <Field data-invalid={errors.pricePerHourCents ? true : undefined}>
                <FieldLabel htmlFor="book-price">Valor/hora</FieldLabel>
                <Controller
                  name="pricePerHourCents"
                  control={control}
                  render={({ field }) => (
                    <MoneyInput
                      id="book-price"
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      min={PRICE_PER_HOUR_MIN_CENTS}
                      max={PRICE_PER_HOUR_MAX_CENTS}
                      disabled={isSubmitting}
                      aria-invalid={errors.pricePerHourCents ? true : undefined}
                    />
                  )}
                />
                <FieldError>{errors.pricePerHourCents?.message}</FieldError>
              </Field>

              <Field data-invalid={errors.numChapters ? true : undefined}>
                <FieldLabel htmlFor="book-chapters">Capítulos</FieldLabel>
                <Controller
                  name="numChapters"
                  control={control}
                  render={({ field }) => (
                    <ChapterCountInput
                      id="book-chapters"
                      value={field.value ?? CHAPTER_COUNT_MIN}
                      onChange={field.onChange}
                      min={CHAPTER_COUNT_MIN}
                      max={CHAPTER_COUNT_MAX}
                      disabled={isSubmitting}
                      aria-invalid={errors.numChapters ? true : undefined}
                    />
                  )}
                />
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
              disabled={isSubmitting || !isValid}
              data-testid="book-create-submit"
            >
              {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
