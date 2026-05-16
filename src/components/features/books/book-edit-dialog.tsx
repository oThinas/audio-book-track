"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Studio } from "@/lib/domain/studio";
import { type UpdateBookInput, updateBookSchema } from "@/lib/schemas/book";
import { cn, formatCentsBRL } from "@/lib/utils";

import { useEditBookForm } from "./hooks/use-edit-book-form";
import { StudioInlineCreator } from "./studio-inline-creator";

const PRICE_PER_HOUR_MIN_CENTS = 1;
const PRICE_PER_HOUR_MAX_CENTS = 999_999;

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
    readonly title: string;
    readonly position: number;
    readonly status: import("@/lib/domain/chapter").ChapterStatus;
    readonly narrator: { readonly id: string; readonly name: string } | null;
    readonly editor: { readonly id: string; readonly name: string } | null;
    readonly editedSeconds: number;
    readonly deadline: string | null;
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
  const form = useForm<UpdateBookInput>({
    resolver: zodResolver(updateBookSchema),
    mode: "onChange",
    // `values` (not `defaultValues`) keeps the form synced with the latest
    // book prop after `router.refresh()`. RHF re-seeds whenever any field
    // here changes, no useEffect needed.
    values: {
      title: book.title,
      studioId: book.studioId,
      pricePerHourCents: book.pricePerHourCents,
    },
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty, isValid },
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
  } = useEditBookForm({ book, studios, form, onUpdated, onOpenChange });

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
                                <CommandSeparator />
                                <CommandGroup>
                                  <CommandItem
                                    value="__inline_create_studio__"
                                    onSelect={() => setShowInlineCreator(true)}
                                    data-testid="book-edit-studio-inline-create"
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
                    </Tooltip>
                  </TooltipProvider>
                )}
              />
              <FieldError>{errors.studioId?.message}</FieldError>
            </Field>

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
