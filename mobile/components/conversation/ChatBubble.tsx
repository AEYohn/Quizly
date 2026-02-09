import { View, Text } from "react-native";
import { PartyPopper, BookOpen, Info } from "lucide-react-native";
import { MathText } from "@/components/common/MathText";
import type { ChatMessage, SessionAction } from "@/types/learn";

interface ChatBubbleProps {
  message: ChatMessage;
}

function getActionStyle(action?: SessionAction) {
  switch (action) {
    case "celebrate":
      return {
        bg: "bg-emerald-50 rounded-tl-sm border border-emerald-200",
        textColor: "#065F46",
        Icon: PartyPopper,
        iconColor: "#10B981",
      };
    case "plan_update":
      return {
        bg: "bg-sky-50 rounded-tl-sm border border-sky-200",
        textColor: "#0C4A6E",
        Icon: Info,
        iconColor: "#0EA5E9",
      };
    case "teach":
      return {
        bg: "bg-purple-50 rounded-tl-sm border border-purple-200",
        textColor: "#581C87",
        Icon: BookOpen,
        iconColor: "#A855F7",
      };
    default:
      return null;
  }
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isAi = message.role === "ai";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <View className="items-center my-2 px-8">
        <Text className="text-xs text-gray-400 text-center">
          {message.content}
        </Text>
      </View>
    );
  }

  const actionStyle = isAi ? getActionStyle(message.action) : null;

  return (
    <View
      className={`max-w-[85%] mb-2.5 ${isAi ? "self-start" : "self-end"}`}
    >
      <View
        className={`rounded-2xl px-4 py-3 ${
          actionStyle
            ? actionStyle.bg
            : isAi
              ? "bg-gray-100 rounded-tl-sm"
              : "bg-indigo-600 rounded-tr-sm"
        }`}
      >
        {actionStyle && (
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <actionStyle.Icon size={14} color={actionStyle.iconColor} />
            <Text style={{ color: actionStyle.iconColor }} className="text-xs font-semibold">
              {message.action === "celebrate"
                ? "Nice work!"
                : message.action === "plan_update"
                  ? "Plan Update"
                  : "Lesson"}
            </Text>
          </View>
        )}
        <MathText
          text={message.content}
          style={{
            fontSize: 15,
            color: actionStyle
              ? actionStyle.textColor
              : isAi
                ? "#1F2937"
                : "#FFFFFF",
            lineHeight: 22,
          }}
        />
      </View>
    </View>
  );
}
