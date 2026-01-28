import { View, TextInput, Text, TextInputProps } from "react-native";
import { forwardRef, useState } from "react";
import { LucideIcon } from "lucide-react-native";

interface InputProps extends Omit<TextInputProps, "className"> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  size?: "sm" | "md" | "lg";
  className?: string;
  containerClassName?: string;
}

const sizeStyles = {
  sm: {
    input: "text-sm py-2 px-3",
    icon: 16,
    padding: 36,
  },
  md: {
    input: "text-base py-3 px-4",
    icon: 20,
    padding: 44,
  },
  lg: {
    input: "text-lg py-4 px-5",
    icon: 24,
    padding: 52,
  },
};

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      icon: Icon,
      iconPosition = "left",
      size = "md",
      className = "",
      containerClassName = "",
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const sizeStyle = sizeStyles[size];

    const hasIcon = !!Icon;
    const paddingStyle = hasIcon
      ? iconPosition === "left"
        ? { paddingLeft: sizeStyle.padding }
        : { paddingRight: sizeStyle.padding }
      : {};

    return (
      <View className={containerClassName}>
        {label && (
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            {label}
          </Text>
        )}
        <View className="relative">
          {Icon && iconPosition === "left" && (
            <View className="absolute left-3 top-0 bottom-0 justify-center z-10">
              <Icon size={sizeStyle.icon} color={isFocused ? "#6366F1" : "#9CA3AF"} />
            </View>
          )}
          <TextInput
            ref={ref}
            className={`
              ${sizeStyle.input}
              bg-gray-50 border rounded-xl
              ${error ? "border-error-500" : isFocused ? "border-primary-500" : "border-gray-200"}
              text-gray-900 placeholder:text-gray-400
              ${className}
            `}
            style={paddingStyle}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            placeholderTextColor="#9CA3AF"
            {...props}
          />
          {Icon && iconPosition === "right" && (
            <View className="absolute right-3 top-0 bottom-0 justify-center z-10">
              <Icon size={sizeStyle.icon} color={isFocused ? "#6366F1" : "#9CA3AF"} />
            </View>
          )}
        </View>
        {error && (
          <Text className="text-sm text-error-500 mt-1">{error}</Text>
        )}
        {hint && !error && (
          <Text className="text-sm text-gray-500 mt-1">{hint}</Text>
        )}
      </View>
    );
  }
);

Input.displayName = "Input";
