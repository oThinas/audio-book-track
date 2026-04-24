"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ApiErrorBody } from "@/lib/api/error-response";
import type { Studio } from "@/lib/domain/studio";
import { type CreateBookInput, createBookSchema } from "@/lib/schemas/book";
import { cn, formatCentsBRL } from "@/lib/utils";

import { CHAPTER_COUNT_MAX, CHAPTER_COUNT_MIN, ChapterCountInput } from "./chapter-count-input";

const PRICE_PER_HOUR_MIN_CENTS = 1;
const PRICE_PER_HOUR_MAX_CENTS = 999_999;

export interface CreatedBook {
  readonly id: string;
  readonly title: string;
  readonly studioId: string;
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

  const sortedStudios = useMemo(
    () => [...studios].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [studios],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
    setError,
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

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
      setStudioPickerOpen(false);
    }
    onOpenChange(next);
  }

  async function onSubmit(values: CreateBookInput) {
    const response = await fetch("/api/v1/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.status === 201) {
      const body = (await response.json()) as { data: CreatedBook };
      reset();
      onCreated(body.data);
      return;
    }

    if (response.status === 422) {
      const body = (await response.json()) as ApiErrorBody;
      if (body.error.code === "STUDIO_NOT_FOUND") {
        setError("studioId", { message: "Estúdio não encontrado ou arquivado." });
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

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <Label htmlFor="book-title">Título</Label>
              <Input
                id="book-title"
                placeholder="Dom Casmurro"
                autoComplete="off"
                aria-invalid={errors.title ? true : undefined}
                disabled={isSubmitting}
                {...register("title")}
              />
              {errors.title && (
                <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="book-studio">Estúdio</Label>
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
                                data-testid={`book-studio-item-${studio.id}`}
                              >
                                <Check
                                  aria-hidden="true"
                                  className={cn(
                                    "mr-2 size-4",
                                    field.value === studio.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <span className="flex-1">{studio.name}</span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {formatCentsBRL(studio.defaultHourlyRateCents)}/h
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.studioId && (
                <p className="mt-1 text-xs text-destructive">{errors.studioId.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="book-price">Valor/hora</Label>
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
              {errors.pricePerHourCents && (
                <p className="mt-1 text-xs text-destructive">{errors.pricePerHourCents.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="book-chapters">Quantidade de capítulos</Label>
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
              {errors.numChapters && (
                <p className="mt-1 text-xs text-destructive">{errors.numChapters.message}</p>
              )}
            </div>
          </div>

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
