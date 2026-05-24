export const AUDIT_ACTIONS = {
  STUDIO_CREATE: "studio.create",
  STUDIO_UPDATE: "studio.update",
  STUDIO_DELETE: "studio.delete",
  STUDIO_REACTIVATE: "studio.reactivate",

  BOOK_CREATE: "book.create",
  BOOK_UPDATE: "book.update",
  BOOK_DELETE: "book.delete",

  CHAPTER_CREATE: "chapter.create",
  CHAPTER_UPDATE: "chapter.update",
  CHAPTER_DELETE: "chapter.delete",
  CHAPTER_BULK_DELETE: "chapter.bulk_delete",
  CHAPTER_REORDER: "chapter.reorder",
  CHAPTER_STATUS_TRANSITION: "chapter.status.transitioned",

  NARRATOR_CREATE: "narrator.create",
  NARRATOR_UPDATE: "narrator.update",
  NARRATOR_DELETE: "narrator.delete",
  NARRATOR_REACTIVATE: "narrator.reactivate",

  EDITOR_CREATE: "editor.create",
  EDITOR_UPDATE: "editor.update",
  EDITOR_DELETE: "editor.delete",
  EDITOR_REACTIVATE: "editor.reactivate",

  AUTH_LOGIN_SUCCESS: "auth.login.success",
  AUTH_LOGIN_FAILED: "auth.login.failed",
  AUTH_LOGOUT: "auth.logout",
  AUTH_SIGNUP: "auth.signup",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
