import { z } from "zod";

export const THEMES = ["light", "dark", "system"] as const;
export const FONT_SIZES = ["small", "medium", "large"] as const;
export const PRIMARY_COLORS = ["blue", "orange", "green", "red", "amber"] as const;
export const FAVORITE_PAGES = [
  "dashboard",
  "books",
  "studios",
  "editors",
  "narrators",
  "settings",
] as const;

export type Theme = (typeof THEMES)[number];
export type FontSize = (typeof FONT_SIZES)[number];
export type PrimaryColor = (typeof PRIMARY_COLORS)[number];
export type FavoritePage = (typeof FAVORITE_PAGES)[number];

export interface UserPreference {
  readonly theme: Theme;
  readonly fontSize: FontSize;
  readonly primaryColor: PrimaryColor;
  readonly favoritePage: FavoritePage;
}

export const DEFAULT_USER_PREFERENCE: UserPreference = {
  theme: "system",
  fontSize: "medium",
  primaryColor: "blue",
  favoritePage: "dashboard",
} as const;

export const themeSchema = z.enum(THEMES);
export const fontSizeSchema = z.enum(FONT_SIZES);
export const primaryColorSchema = z.enum(PRIMARY_COLORS);
export const favoritePageSchema = z.enum(FAVORITE_PAGES);

export const updateUserPreferenceSchema = z
  .object({
    theme: themeSchema.optional(),
    fontSize: fontSizeSchema.optional(),
    primaryColor: primaryColorSchema.optional(),
    favoritePage: favoritePageSchema.optional(),
  })
  .refine(
    (data) =>
      data.theme !== undefined ||
      data.fontSize !== undefined ||
      data.primaryColor !== undefined ||
      data.favoritePage !== undefined,
    { message: "Pelo menos um campo deve ser informado." },
  );

export type UpdateUserPreference = z.infer<typeof updateUserPreferenceSchema>;
