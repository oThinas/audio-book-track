import { bookCodes } from "./book";
import { chapterCodes } from "./chapter";
import { editorCodes } from "./editor";
import { narratorCodes } from "./narrator";
import { platformCodes } from "./platform";
import { studioCodes } from "./studio";
import type { ErrorCatalogEntry } from "./types";

export type { ErrorCatalogEntry } from "./types";

export const errorCodes = {
  ...platformCodes,
  ...studioCodes,
  ...bookCodes,
  ...chapterCodes,
  ...narratorCodes,
  ...editorCodes,
} satisfies Readonly<Record<string, ErrorCatalogEntry>>;

export type ErrorCode = keyof typeof errorCodes;
