import { useColorScheme } from 'react-native';

const lightColors = {
  brand: '#6366F1',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
};

const darkColors = {
  brand: '#818CF8',
  textPrimary: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textMuted: '#6B7280',
  border: '#374151',
  background: '#111827',
  surface: '#1F2937',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
};

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
  };
}
