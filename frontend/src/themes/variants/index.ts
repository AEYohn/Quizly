import type { ThemeTokens } from "../types";
import type { VariantName } from "../types";

import cosmicTheme from "./cosmic";

export { cosmicTheme };

export const themes: Record<VariantName, ThemeTokens> = {
    cosmic: cosmicTheme,
};
