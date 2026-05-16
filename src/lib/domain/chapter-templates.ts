export const CHAPTER_TEMPLATES = {
  prologue: { label: "Prólogo", defaultTitle: "Prólogo" },
  epilogue: { label: "Epílogo", defaultTitle: "Epílogo" },
  presentation: { label: "Apresentação", defaultTitle: "Apresentação" },
} as const;

export type ChapterTemplateKey = keyof typeof CHAPTER_TEMPLATES;

export const CHAPTER_TEMPLATE_KEYS: ReadonlyArray<ChapterTemplateKey> = [
  "prologue",
  "epilogue",
  "presentation",
] as const;
