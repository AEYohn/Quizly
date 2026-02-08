import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { X, Send, Sparkles } from "lucide-react-native";
import { useSocraticHelp } from "@/hooks/feed/useSocraticHelp";
import type { ScrollCard } from "@/types/learn";

interface SocraticHelpSheetProps {
  visible: boolean;
  card: ScrollCard;
  sessionId: string;
  onClose: () => void;
}

export function SocraticHelpSheet({
  visible,
  card,
  sessionId,
  onClose,
}: SocraticHelpSheetProps) {
  const { messages, isLoading, showReadyButton, sendMessage } =
    useSocraticHelp(card, sessionId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage(text);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-white"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
          <View className="flex-row items-center gap-2">
            <Sparkles size={18} color="#6366F1" />
            <Text className="text-base font-semibold text-gray-900">
              Guided Help
            </Text>
          </View>
          <Pressable onPress={onClose} className="p-2">
            <X size={20} color="#6B7280" />
          </Pressable>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4 py-3"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, idx) => (
            <View
              key={idx}
              className={`mb-3 max-w-[85%] ${
                msg.role === "student" ? "self-end" : "self-start"
              }`}
            >
              <View
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === "student"
                    ? "bg-indigo-600"
                    : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-sm leading-5 ${
                    msg.role === "student" ? "text-white" : "text-gray-800"
                  }`}
                >
                  {msg.content}
                </Text>
              </View>
            </View>
          ))}

          {isLoading && (
            <View className="self-start mb-3">
              <View className="bg-gray-100 rounded-2xl px-4 py-3">
                <Text className="text-sm text-gray-400">Thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Ready button */}
        {showReadyButton && (
          <Pressable
            onPress={onClose}
            className="mx-4 mb-2 bg-emerald-600 rounded-xl py-3 items-center active:bg-emerald-700"
          >
            <Text className="text-white font-semibold">
              I'm ready to try!
            </Text>
          </Pressable>
        )}

        {/* Input */}
        <View className="flex-row items-center px-4 py-3 border-t border-gray-200 gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-900"
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || isLoading}
            className={`p-2.5 rounded-xl ${
              input.trim() && !isLoading ? "bg-indigo-600" : "bg-gray-200"
            }`}
          >
            <Send
              size={18}
              color={input.trim() && !isLoading ? "#FFFFFF" : "#9CA3AF"}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
