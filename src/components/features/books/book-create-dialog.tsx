"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

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
import type { Studio } from "@/lib/domain/studio";
import { type CreateBookInput, createBookSchema } from "@/lib/schemas/book";
import { cn, formatCentsBRL } from "@/lib/utils";

import { type BookExtraInputValue, BookExtrasInput } from "./book-extras-input";
import { CHAPTER_COUNT_MAX, ChapterCountInput } from "./chapter-count-input";
import { useCreateBookForm } from "./hooks/use-create-book-form";
import { StudioInlineCreator } from "./studio-inline-creator";

const PRICE_PER_HOUR_MIN_CENTS = 1;
const PRICE_PER_HOUR_MAX_CENTS = 999_999;

export interface CreatedBook {
  readonly id: string;
  readonly title: string;
  readonly studio: { readonly id: string; readonly name: string };
  readonly pricePerHourCents: number;
  readonly chapters: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly position: number;
  }>;
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
  const form = useForm<CreateBookInput>({
    resolver: zodResolver(createBookSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      studioId: "",
      pricePerHourCents: 0,
      chapters: { numbered: 1, extras: [] },
    },
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const {
    studioOptions,
    selectedStudio,
    studioPickerOpen,
    setStudioPickerOpen,
    showInlineCreator,
    setShowInlineCreator,
    handleInlineStudioCreated,
    handleOpenChange,
    onSubmit,
  } = useCreateBookForm({ studios, form, onCreated, onOpenChange });

  const [step, setStep] = useState<1 | 2>(1);

  // When the dialog closes, snap back to step 1 so the next open starts fresh.
  useEffect(() => {
    if (!open) setStep(1);
  }, [open]);

  // If the API attaches an error to a step-1 field after submit (e.g.
  // TITLE_ALREADY_IN_USE), bring the user back to step 1 so they can see it.
  useEffect(() => {
    if (step !== 2) return;
    if (errors.title || errors.studioId || errors.pricePerHourCents) {
      setStep(1);
    }
  }, [step, errors.title, errors.studioId, errors.pricePerHourCents]);

  const watchedTitle = useWatch({ control, name: "title" });
  const watchedStudio = useWatch({ control, name: "studioId" });
  const watchedPrice = useWatch({ control, name: "pricePerHourCents" });
  const step1Filled =
    Boolean(watchedTitle?.trim()) && Boolean(watchedStudio) && (watchedPrice ?? 0) > 0;
  const step1HasErrors = Boolean(errors.title || errors.studioId || errors.pricePerHourCents);
  const canAdvance = step1Filled && !step1HasErrors;

  function goToStep2() {
    if (!canAdvance) return;
    // Defer the state change to the next tick. If we change step inside the
    // click handler, React re-renders during the click event sequence and
    // the type="submit" Confirmar button slides into the same DOM position as
    // the type="button" Próximo button — Chrome then dispatches the click
    // to the new (submit) button, accidentally submitting the form.
    setTimeout(() => setStep(2), 0);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="book-create-dialog"
        data-step={step}
        className={cn(
          "transition-[max-width] duration-200 ease-out",
          step === 1 ? "sm:max-w-md" : "sm:max-w-2xl",
        )}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>Novo Livro</DialogTitle>
            <DialogDescription>
              {step === 1
                ? "Etapa 1 de 2 — informações do livro."
                : "Etapa 2 de 2 — capítulos iniciais."}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
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
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0"
                        align="start"
                      >
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
                                {studioOptions.map((studio) => (
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
            </FieldGroup>
          )}

          {step === 2 && (
            <FieldGroup className="mt-4">
              <Field data-invalid={errors.chapters?.numbered ? true : undefined}>
                <FieldLabel htmlFor="book-chapters">Capítulos numerados</FieldLabel>
                <Controller
                  name="chapters.numbered"
                  control={control}
                  render={({ field }) => (
                    <ChapterCountInput
                      id="book-chapters"
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      min={0}
                      max={CHAPTER_COUNT_MAX}
                      disabled={isSubmitting}
                      aria-invalid={errors.chapters?.numbered ? true : undefined}
                    />
                  )}
                />
                <FieldError>{errors.chapters?.numbered?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel>Capítulos extras</FieldLabel>
                <Controller
                  name="chapters.extras"
                  control={control}
                  render={({ field }) => (
                    <BookExtrasInput
                      value={(field.value ?? []) as ReadonlyArray<BookExtraInputValue>}
                      onChange={(next) => field.onChange(next)}
                      disabled={isSubmitting}
                    />
                  )}
                />
                {errors.chapters?.message && <FieldError>{errors.chapters.message}</FieldError>}
              </Field>
            </FieldGroup>
          )}

          <DialogFooter className="mt-6">
            {step === 1 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={goToStep2}
                  disabled={!canAdvance}
                  data-testid="book-create-next"
                >
                  Próximo
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                  data-testid="book-create-back"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Voltar
                </Button>
                <Button type="submit" disabled={isSubmitting} data-testid="book-create-submit">
                  {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" />}
                  Confirmar
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
