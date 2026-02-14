import { useState } from "react";
import { View, TextInput, Pressable } from "react-native";
import { Send } from "lucide-react-native";

interface DiscussionInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DiscussionInput({
  onSend,
  disabled = false,
  placeholder = "Type your thoughts...",
}: DiscussionInputProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <View className="flex-row items-end gap-2 px-4 pb-2 pt-1">
      <View className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 max-h-24">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline
          className="text-sm text-gray-900 leading-5"
          style={{ maxHeight: 80 }}
          editable={!disabled}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
      </View>
      <Pressable
        onPress={handleSend}
        disabled={disabled || !text.trim()}
        className={`w-10 h-10 rounded-full items-center justify-center ${
          text.trim() && !disabled
            ? "bg-indigo-600 active:bg-indigo-700"
            : "bg-gray-200"
        }`}
      >
        <Send
          size={18}
          color={text.trim() && !disabled ? "#FFFFFF" : "#9CA3AF"}
        />
      </Pressable>
    </View>
  );
}
