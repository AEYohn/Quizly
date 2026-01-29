import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

interface ThemeColors {
  brand: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  background: string;
  surface: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
}

const lightColors: ThemeColors = {
  brand: '#6366F1',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

const darkColors: ThemeColors = {
  brand: '#818CF8',
  textPrimary: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textMuted: '#6B7280',
  background: '#111827',
  surface: '#1F2937',
  border: '#374151',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
};

const ThemeContext = createContext<ThemeContextType | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const value = useMemo(
    () => ({
      colors: isDark ? darkColors : lightColors,
      isDark,
    }),
    [isDark]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return default light theme if provider is not used
    return {
      colors: lightColors,
      isDark: false,
    };
  }
  return context;
}
