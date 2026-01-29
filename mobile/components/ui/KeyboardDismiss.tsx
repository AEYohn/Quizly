import { Keyboard, TouchableWithoutFeedback, View } from "react-native";

interface KeyboardDismissProps {
  children: React.ReactNode;
  className?: string;
}

export function KeyboardDismiss({ children, className }: KeyboardDismissProps) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View className={className || "flex-1"}>{children}</View>
    </TouchableWithoutFeedback>
  );
}
