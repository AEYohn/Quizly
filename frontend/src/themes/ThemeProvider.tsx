"use client";

import React, { createContext, useContext, useEffect } from "react";
import type { VariantName } from "./types";

interface ThemeContextType {
    variant: VariantName;
}

const ThemeContext = createContext<ThemeContextType>({ variant: "brilliant" });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        document.documentElement.setAttribute("data-variant", "brilliant");
    }, []);

    return (
        <ThemeContext.Provider value={{ variant: "brilliant" }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
