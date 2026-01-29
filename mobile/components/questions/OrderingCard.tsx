import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { GripVertical, Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/providers/ThemeProvider';
import { OrderingQuestion, OrderingItem } from '@/types/questions';

interface OrderingCardProps {
  question: OrderingQuestion;
  onAnswer: (order: string[]) => void;
  showFeedback?: boolean;
  disabled?: boolean;
}

export function OrderingCard({
  question,
  onAnswer,
  showFeedback = false,
  disabled = false,
}: OrderingCardProps) {
  const { colors, isDark } = useTheme();

  // Light color variants (not in theme)
  const successLight = isDark ? '#065F46' : '#D1FAE5';
  const errorLight = isDark ? '#7F1D1D' : '#FEE2E2';
  const brandLight = isDark ? '#312E81' : '#E0E7FF';

  // Shuffle items initially
  const [items, setItems] = useState<OrderingItem[]>(() => {
    return [...question.items].sort(() => Math.random() - 0.5);
  });

  const handleDragEnd = ({ data }: { data: OrderingItem[] }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(data);
    onAnswer(data.map((item) => item.id));
  };

  const isItemCorrect = (itemId: string, index: number): boolean => {
    return question.correct_order[index] === itemId;
  };

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<OrderingItem>) => {
    const index = getIndex() ?? 0;
    const correct = showFeedback && isItemCorrect(item.id, index);
    const incorrect = showFeedback && !isItemCorrect(item.id, index);

    return (
      <ScaleDecorator>
        <View
          style={[
            styles.item,
            {
              backgroundColor: isActive
                ? brandLight
                : correct
                ? successLight
                : incorrect
                ? errorLight
                : isDark
                ? '#1F2937'
                : '#FFFFFF',
              borderColor: isActive
                ? colors.brand
                : correct
                ? colors.success
                : incorrect
                ? colors.error
                : colors.border,
            },
          ]}
        >
          <View style={[styles.indexBadge, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
            <Text style={[styles.indexText, { color: colors.textMuted }]}>
              {index + 1}
            </Text>
          </View>

          <Text
            style={[styles.itemText, { color: colors.textPrimary, flex: 1 }]}
          >
            {item.text}
          </Text>

          {showFeedback ? (
            correct ? (
              <Check size={20} color={colors.success} />
            ) : (
              <X size={20} color={colors.error} />
            )
          ) : (
            <View
              onTouchStart={disabled ? undefined : drag}
              style={styles.handle}
            >
              <GripVertical size={20} color={colors.textMuted} />
            </View>
          )}
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.instruction, { color: colors.textSecondary }]}>
        {question.instruction}
      </Text>

      <DraggableFlatList
        data={items}
        keyExtractor={(item) => item.id}
        onDragEnd={handleDragEnd}
        renderItem={renderItem}
        containerStyle={styles.list}
        dragItemOverflow
        activationDistance={disabled ? 1000 : 10}
      />

      {showFeedback && question.explanation && (
        <View
          style={[
            styles.explanation,
            { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
          ]}
        >
          <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
            {question.explanation}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  instruction: {
    fontSize: 14,
    marginBottom: 16,
  },
  list: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  indexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  indexText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemText: {
    fontSize: 14,
  },
  handle: {
    padding: 4,
    marginLeft: 8,
  },
  explanation: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
