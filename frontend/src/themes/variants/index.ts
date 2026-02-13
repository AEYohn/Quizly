import type { ThemeTokens } from "../types";
import type { VariantName } from "../types";

import brilliantTheme from "./brilliant";

export { brilliantTheme };

export const themes: Record<VariantName, ThemeTokens> = {
    brilliant: brilliantTheme,
};
