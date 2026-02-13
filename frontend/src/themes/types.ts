export interface ThemeTokens {
    name: string;
    label: string;
    // Colors
    bgPrimary: string;
    bgSecondary: string;
    bgCard: string;
    bgCardBorder: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentLight: string;
    accentDark: string;
    correct: string;
    incorrect: string;
    xp: string;
    streak: string;
    // Typography
    fontHeading: string;
    fontBody: string;
    fontMono: string;
    // Shape
    borderRadius: string;
    cardRadius: string;
    // Mode
    isDark: boolean;
}

export type VariantName = "brilliant";

export const VARIANT_NAMES: VariantName[] = ["brilliant"];

export const VARIANT_LABELS: Record<VariantName, string> = {
    brilliant: "Brilliant",
};
