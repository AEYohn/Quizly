import { Pressable, Text, ActivityIndicator, View } from "react-native";
import { forwardRef } from "react";
import { LucideIcon } from "lucide-react-native";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  className?: string;
}

const variantStyles: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: "bg-primary-500 active:bg-primary-600",
    text: "text-white",
  },
  secondary: {
    container: "bg-gray-100 active:bg-gray-200",
    text: "text-gray-900",
  },
  outline: {
    container: "border-2 border-primary-500 active:bg-primary-50",
    text: "text-primary-600",
  },
  ghost: {
    container: "active:bg-gray-100",
    text: "text-gray-700",
  },
  danger: {
    container: "bg-error-500 active:bg-error-600",
    text: "text-white",
  },
};

const sizeStyles: Record<ButtonSize, { container: string; text: string; icon: number }> = {
  sm: {
    container: "px-3 py-2 rounded-lg",
    text: "text-sm font-medium",
    icon: 16,
  },
  md: {
    container: "px-4 py-3 rounded-xl",
    text: "text-base font-semibold",
    icon: 20,
  },
  lg: {
    container: "px-6 py-4 rounded-xl",
    text: "text-lg font-semibold",
    icon: 24,
  },
};

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      children,
      onPress,
      variant = "primary",
      size = "md",
      disabled = false,
      loading = false,
      icon: Icon,
      iconPosition = "left",
      fullWidth = false,
      className = "",
    },
    ref
  ) => {
    const variantStyle = variantStyles[variant];
    const sizeStyle = sizeStyles[size];

    const isDisabled = disabled || loading;

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        disabled={isDisabled}
        className={`
          flex-row items-center justify-center
          ${sizeStyle.container}
          ${variantStyle.container}
          ${isDisabled ? "opacity-50" : ""}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === "primary" || variant === "danger" ? "#fff" : "#6366F1"}
            size="small"
          />
        ) : (
          <>
            {Icon && iconPosition === "left" && (
              <Icon
                size={sizeStyle.icon}
                color={variant === "primary" || variant === "danger" ? "#fff" : "#6366F1"}
                style={{ marginRight: 8 }}
              />
            )}
            <Text className={`${sizeStyle.text} ${variantStyle.text}`}>
              {children}
            </Text>
            {Icon && iconPosition === "right" && (
              <Icon
                size={sizeStyle.icon}
                color={variant === "primary" || variant === "danger" ? "#fff" : "#6366F1"}
                style={{ marginLeft: 8 }}
              />
            )}
          </>
        )}
      </Pressable>
    );
  }
);

Button.displayName = "Button";
