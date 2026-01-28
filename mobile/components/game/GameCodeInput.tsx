import { View, TextInput, Text } from "react-native";
import { useState, useRef, useEffect } from "react";

interface GameCodeInputProps {
  value: string;
  onChange: (code: string) => void;
  error?: string;
  autoFocus?: boolean;
}

const CODE_LENGTH = 6;

export function GameCodeInput({
  value,
  onChange,
  error,
  autoFocus = false,
}: GameCodeInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const handleChange = (text: string) => {
    // Only allow alphanumeric characters, convert to uppercase
    const cleaned = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (cleaned.length <= CODE_LENGTH) {
      onChange(cleaned);
    }
  };

  const handlePress = () => {
    inputRef.current?.focus();
  };

  return (
    <View className="items-center">
      <View
        className={`
          flex-row justify-center items-center gap-2
          ${isFocused ? "opacity-100" : "opacity-90"}
        `}
        onTouchEnd={handlePress}
      >
        {Array.from({ length: CODE_LENGTH }).map((_, index) => {
          const char = value[index] || "";
          const isActive = index === value.length && isFocused;

          return (
            <View
              key={index}
              className={`
                w-12 h-14 rounded-xl justify-center items-center
                ${char ? "bg-primary-100 border-2 border-primary-500" : "bg-gray-100 border-2 border-gray-200"}
                ${isActive ? "border-primary-500" : ""}
                ${error ? "border-error-500" : ""}
              `}
            >
              <Text
                className={`
                  text-2xl font-bold
                  ${char ? "text-primary-700" : "text-gray-400"}
                `}
              >
                {char || (isActive ? "|" : "")}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Hidden input */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType="default"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={CODE_LENGTH}
        style={{
          position: "absolute",
          opacity: 0,
          height: 1,
          width: 1,
        }}
      />

      {error && (
        <Text className="text-error-500 text-sm mt-3">{error}</Text>
      )}

      <Text className="text-gray-500 text-sm mt-3">
        Enter the 6-character game code
      </Text>
    </View>
  );
}
