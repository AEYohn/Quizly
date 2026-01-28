import { View, Text, Pressable, Dimensions } from "react-native";
import { useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { RotateCcw } from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface FlashcardProps {
  question: string;
  answer: string;
  explanation?: string;
  cardNumber?: number;
  totalCards?: number;
  onNext?: () => void;
  onPrevious?: () => void;
}

export function Flashcard({
  question,
  answer,
  explanation,
  cardNumber,
  totalCards,
}: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const rotation = useSharedValue(0);

  const handleFlip = () => {
    const newValue = isFlipped ? 0 : 180;
    rotation.value = withTiming(newValue, { duration: 400 });
    setIsFlipped(!isFlipped);
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      rotation.value,
      [0, 180],
      [0, 180],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden",
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      rotation.value,
      [0, 180],
      [180, 360],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden",
    };
  });

  return (
    <View className="items-center">
      {/* Card Counter */}
      {cardNumber && totalCards && (
        <View className="mb-4">
          <Text className="text-gray-500 font-medium">
            Card {cardNumber} of {totalCards}
          </Text>
        </View>
      )}

      {/* Flashcard */}
      <Pressable onPress={handleFlip} className="relative">
        {/* Front Side (Question) */}
        <Animated.View
          style={[frontAnimatedStyle, { width: SCREEN_WIDTH - 48 }]}
          className="absolute bg-white rounded-3xl shadow-lg p-6 min-h-[280px] justify-center"
        >
          <View className="absolute top-4 left-4 bg-primary-100 px-3 py-1 rounded-full">
            <Text className="text-primary-700 text-sm font-medium">
              Question
            </Text>
          </View>
          <Text className="text-xl font-semibold text-gray-900 text-center leading-8 mt-4">
            {question}
          </Text>
          <View className="absolute bottom-4 left-0 right-0 items-center">
            <View className="flex-row items-center">
              <RotateCcw size={16} color="#9CA3AF" />
              <Text className="text-gray-400 text-sm ml-2">
                Tap to reveal answer
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Back Side (Answer) */}
        <Animated.View
          style={[backAnimatedStyle, { width: SCREEN_WIDTH - 48 }]}
          className="bg-primary-500 rounded-3xl shadow-lg p-6 min-h-[280px] justify-center"
        >
          <View className="absolute top-4 left-4 bg-white/20 px-3 py-1 rounded-full">
            <Text className="text-white text-sm font-medium">Answer</Text>
          </View>
          <Text className="text-xl font-semibold text-white text-center leading-8 mt-4">
            {answer}
          </Text>
          {explanation && (
            <View className="mt-4 pt-4 border-t border-white/20">
              <Text className="text-white/80 text-center text-sm">
                {explanation}
              </Text>
            </View>
          )}
          <View className="absolute bottom-4 left-0 right-0 items-center">
            <View className="flex-row items-center">
              <RotateCcw size={16} color="rgba(255,255,255,0.6)" />
              <Text className="text-white/60 text-sm ml-2">
                Tap to see question
              </Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>

      {/* Instructions */}
      <View className="mt-6 px-4">
        <Text className="text-gray-400 text-center text-sm">
          Swipe left or right to navigate between cards
        </Text>
      </View>
    </View>
  );
}
