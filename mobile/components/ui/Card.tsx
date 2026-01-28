import { View, Pressable, PressableProps } from "react-native";
import { forwardRef } from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "outline";
  padding?: "none" | "sm" | "md" | "lg";
}

interface PressableCardProps extends CardProps, Omit<PressableProps, "className" | "children"> {}

const variantStyles = {
  default: "bg-white",
  elevated: "bg-white shadow-lg shadow-black/10",
  outline: "bg-white border border-gray-200",
};

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export const Card = forwardRef<View, CardProps>(
  ({ children, className = "", variant = "default", padding = "md" }, ref) => {
    return (
      <View
        ref={ref}
        className={`
          rounded-2xl
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${className}
        `}
      >
        {children}
      </View>
    );
  }
);

Card.displayName = "Card";

export const PressableCard = forwardRef<View, PressableCardProps>(
  (
    { children, className = "", variant = "default", padding = "md", ...pressableProps },
    ref
  ) => {
    return (
      <Pressable
        ref={ref}
        className={`
          rounded-2xl
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          active:opacity-90 active:scale-[0.99]
          ${className}
        `}
        {...pressableProps}
      >
        {children}
      </Pressable>
    );
  }
);

PressableCard.displayName = "PressableCard";
