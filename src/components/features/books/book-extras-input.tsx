"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  CHAPTER_TEMPLATE_KEYS,
  CHAPTER_TEMPLATES,
  type ChapterTemplateKey,
} from "@/lib/domain/chapter-templates";

const EXTRAS_MAX = 20;

const KIND_LABELS: Record<"template" | "custom", string> = {
  template: "Template",
  custom: "Personalizado",
};

const POSITION_LABELS: Record<"start" | "end", string> = {
  start: "No início",
  end: "No fim",
};

export type BookExtraInputValue =
  | {
      readonly kind: "template";
      readonly template: ChapterTemplateKey;
      readonly position: "start" | "end";
      readonly _key?: string;
    }
  | {
      readonly kind: "custom";
      readonly title: string;
      readonly position: "start" | "end";
      readonly _key?: string;
    };

interface BookExtrasInputProps {
  readonly value: ReadonlyArray<BookExtraInputValue>;
  readonly onChange: (next: ReadonlyArray<BookExtraInputValue>) => void;
  readonly disabled?: boolean;
}

export function BookExtrasInput({ value, onChange, disabled }: BookExtrasInputProps) {
  const items = value;
  const canAdd = items.length < EXTRAS_MAX;

  function addExtra() {
    if (!canAdd) return;
    onChange([
      ...items,
      {
        kind: "template",
        template: "prologue",
        position: "start",
        _key: crypto.randomUUID(),
      },
    ] as BookExtraInputValue[]);
  }

  function updateAt(index: number, patch: Partial<BookExtraInputValue>) {
    const next = items.map((item, i) => {
      if (i !== index) return item;
      return { ...item, ...patch } as BookExtraInputValue;
    });
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function moveBy(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="book-extras-input">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum capítulo extra. Use o botão abaixo para adicionar.
        </p>
      )}

      {items.map((item, index) => (
        <div
          key={
            item._key ??
            `extra-${item.kind}-${item.position}-${index}-${"title" in item ? item.title : item.template}`
          }
          className="flex flex-col gap-2 rounded-md border border-input p-2 sm:flex-row sm:items-center"
          data-testid={`book-extra-row-${index}`}
        >
          <Select
            value={item.kind}
            onValueChange={(next) => {
              if (next === "template") {
                updateAt(index, {
                  kind: "template",
                  template: "prologue",
                } as Partial<BookExtraInputValue>);
              } else {
                updateAt(index, {
                  kind: "custom",
                  title: "",
                } as Partial<BookExtraInputValue>);
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger
              className="w-full sm:w-36"
              data-testid={`book-extra-kind-${index}`}
              aria-label="Tipo do capítulo extra"
            >
              <span className="truncate">{KIND_LABELS[item.kind]}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="template">Template</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {item.kind === "template" ? (
            <Select
              value={item.template}
              onValueChange={(next) => updateAt(index, { template: next as ChapterTemplateKey })}
              disabled={disabled}
            >
              <SelectTrigger
                className="w-full sm:flex-1"
                data-testid={`book-extra-template-${index}`}
                aria-label="Template"
              >
                <span className="truncate">{CHAPTER_TEMPLATES[item.template].label}</span>
              </SelectTrigger>
              <SelectContent>
                {CHAPTER_TEMPLATE_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {CHAPTER_TEMPLATES[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={item.title}
              onChange={(e) => updateAt(index, { title: e.target.value })}
              placeholder="Título personalizado"
              maxLength={100}
              disabled={disabled}
              aria-label="Título do extra personalizado"
              data-testid={`book-extra-title-${index}`}
              className="w-full sm:flex-1"
            />
          )}

          <Select
            value={item.position}
            onValueChange={(next) => updateAt(index, { position: next as "start" | "end" })}
            disabled={disabled}
          >
            <SelectTrigger
              className="w-full sm:w-32"
              data-testid={`book-extra-position-${index}`}
              aria-label="Posição"
            >
              <span className="truncate">{POSITION_LABELS[item.position]}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="start">No início</SelectItem>
              <SelectItem value="end">No fim</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 self-end sm:self-auto">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Mover para cima"
              data-testid={`book-extra-up-${index}`}
              onClick={() => moveBy(index, -1)}
              disabled={disabled || index === 0}
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Mover para baixo"
              data-testid={`book-extra-down-${index}`}
              onClick={() => moveBy(index, 1)}
              disabled={disabled || index === items.length - 1}
            >
              <ArrowDown aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover extra"
              data-testid={`book-extra-remove-${index}`}
              onClick={() => removeAt(index)}
              disabled={disabled}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addExtra}
        disabled={disabled || !canAdd}
        data-testid="book-extra-add"
        className="self-start"
      >
        <Plus aria-hidden="true" className="size-4" />
        Adicionar extra
      </Button>
      {!canAdd && (
        <span className="text-xs text-muted-foreground">Limite de {EXTRAS_MAX} extras.</span>
      )}
    </div>
  );
}
