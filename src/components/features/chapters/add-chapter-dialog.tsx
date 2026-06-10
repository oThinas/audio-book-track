"use client";

import { Loader2 } from "lucide-react";
import { Controller, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

import { type ChapterCreatedResult, useAddChapter } from "./hooks/use-add-chapter";

const TEMPLATE_LABELS: Record<"prologue" | "presentation" | "epilogue", string> = {
  prologue: "Prólogo",
  presentation: "Apresentação",
  epilogue: "Epílogo",
};

export interface ExistingChapter {
  readonly id: string;
  readonly title: string;
}

interface AddChapterDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly bookId: string;
  readonly chaptersVersion: number;
  readonly existingChapters: ReadonlyArray<ExistingChapter>;
  readonly onCreated: (result: ChapterCreatedResult) => void;
  readonly onConflict: () => void;
}

export function AddChapterDialog({
  open,
  onOpenChange,
  bookId,
  chaptersVersion,
  existingChapters,
  onCreated,
  onConflict,
}: AddChapterDialogProps) {
  const existingTitles = existingChapters.map((c) => c.title);
  const { form, onSubmit } = useAddChapter({
    bookId,
    chaptersVersion,
    existingTitles,
    onCreated: (r) => {
      onCreated(r);
      onOpenChange(false);
    },
    onConflict: () => {
      onConflict();
      onOpenChange(false);
    },
  });
  const {
    control,
    register,
    formState: { isSubmitting, errors },
  } = form;
  const kind = useWatch({ control, name: "kind" });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
    >
      <DialogContent data-testid="add-chapter-dialog">
        <DialogHeader>
          <DialogTitle>Adicionar capítulo</DialogTitle>
          <DialogDescription>
            Escolha o tipo, o título e em qual extremidade do livro inserir. Para posicionar no
            meio, adicione e depois reordene.
          </DialogDescription>
        </DialogHeader>

        <form id="add-chapter-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <Controller
              name="kind"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-4"
                >
                  <Label className="flex items-center gap-2">
                    <RadioGroupItem value="numbered" data-testid="add-chapter-kind-numbered" />
                    Numerado
                  </Label>
                  <Label className="flex items-center gap-2">
                    <RadioGroupItem value="template" data-testid="add-chapter-kind-template" />
                    Template
                  </Label>
                  <Label className="flex items-center gap-2">
                    <RadioGroupItem value="custom" data-testid="add-chapter-kind-custom" />
                    Personalizado
                  </Label>
                </RadioGroup>
              )}
            />
          </div>

          {kind === "template" && (
            <div className="flex flex-col gap-2">
              <Label>Template</Label>
              <Controller
                name="template"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="add-chapter-template" className="w-full">
                      <span className="truncate">{TEMPLATE_LABELS[field.value]}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prologue">Prólogo</SelectItem>
                      <SelectItem value="presentation">Apresentação</SelectItem>
                      <SelectItem value="epilogue">Epílogo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {kind !== "template" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-chapter-title">Título</Label>
              <Input
                id="add-chapter-title"
                data-testid="add-chapter-title"
                maxLength={100}
                {...register("title")}
                disabled={isSubmitting}
              />
              {errors.title?.message && (
                <span
                  role="alert"
                  className="text-xs text-destructive"
                  data-testid="add-chapter-title-error"
                >
                  {errors.title.message}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Posição</Label>
            <Controller
              name="positionMode"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-4"
                >
                  <Label className="flex items-center gap-2">
                    <RadioGroupItem value="start" data-testid="add-chapter-position-start" />
                    No início
                  </Label>
                  <Label className="flex items-center gap-2">
                    <RadioGroupItem value="end" data-testid="add-chapter-position-end" />
                    No fim
                  </Label>
                </RadioGroup>
              )}
            />
            <span className="text-xs text-muted-foreground">
              Para inserir entre capítulos, adicione no início ou no fim e use reordenar.
            </span>
          </div>
        </form>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="add-chapter-form"
            disabled={isSubmitting}
            data-testid="add-chapter-submit"
          >
            {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
