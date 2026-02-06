"use client";

import React, { createContext, useContext, useEffect } from "react";
import type { VariantName } from "./types";

interface ThemeContextType {
    variant: VariantName;
}

const ThemeContext = createContext<ThemeContextType>({ variant: "cosmic" });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        document.documentElement.setAttribute("data-variant", "cosmic");
    }, []);

    return (
        <ThemeContext.Provider value={{ variant: "cosmic" }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
