# Track 3: Content Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add new question types (true/false, fill-in-blank, matching, ordering, code) and complete PDF upload functionality.

**Architecture:** Question types defined in shared types file. QuestionRenderer component routes to type-specific card components. Quiz creation flow extended to support new types.

**Tech Stack:** react-native-draggable-flatlist (for ordering), expo-document-picker, expo-file-system

**Dependencies:** Foundation must be complete (types, theme)

---

## Task 1: Install Dependencies

**Files:**
- Modify: `mobile/package.json`

**Step 1: Install required packages**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm install react-native-draggable-flatlist expo-file-system
```

Expected: Packages added

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add package.json package-lock.json && git commit -m "chore: add draggable-flatlist and file-system for content track"
```

---

## Task 2: Create Extended Question Types

**Files:**
- Create: `mobile/types/questions.ts`

**Step 1: Create comprehensive question types**

Create `mobile/types/questions.ts`:
```typescript
export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_blank'
  | 'matching'
  | 'ordering'
  | 'code';

export interface BaseQuestion {
  id?: string;
  question_type: QuestionType;
  points: number;
  time_limit: number;
  explanation?: string;
  image_url?: string;
  order_index?: number;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  question_type: 'multiple_choice';
  question_text: string;
  options: Record<string, string>;
  correct_answer: string;
}

export interface TrueFalseQuestion extends BaseQuestion {
  question_type: 'true_false';
  statement: string;
  correct_answer: boolean;
}

export interface FillBlankQuestion extends BaseQuestion {
  question_type: 'fill_blank';
  text: string;
  blanks: string[];
  case_sensitive: boolean;
  accept_alternatives?: string[][];
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface MatchingQuestion extends BaseQuestion {
  question_type: 'matching';
  instruction?: string;
  pairs: MatchingPair[];
}

export interface OrderingItem {
  id: string;
  text: string;
}

export interface OrderingQuestion extends BaseQuestion {
  question_type: 'ordering';
  instruction: string;
  items: OrderingItem[];
  correct_order: string[];
}

export interface CodeTestCase {
  input: string;
  expected_output: string;
  is_hidden?: boolean;
}

export type CodeLanguage = 'python' | 'javascript' | 'typescript' | 'sql' | 'java';

export interface CodeQuestion extends BaseQuestion {
  question_type: 'code';
  prompt: string;
  language: CodeLanguage;
  starter_code?: string;
  test_cases: CodeTestCase[];
  solution?: string;
}

export type Question =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | FillBlankQuestion
  | MatchingQuestion
  | OrderingQuestion
  | CodeQuestion;

// Type guards
export function isMultipleChoice(q: Question): q is MultipleChoiceQuestion {
  return q.question_type === 'multiple_choice';
}

export function isTrueFalse(q: Question): q is TrueFalseQuestion {
  return q.question_type === 'true_false';
}

export function isFillBlank(q: Question): q is FillBlankQuestion {
  return q.question_type === 'fill_blank';
}

export function isMatching(q: Question): q is MatchingQuestion {
  return q.question_type === 'matching';
}

export function isOrdering(q: Question): q is OrderingQuestion {
  return q.question_type === 'ordering';
}

export function isCode(q: Question): q is CodeQuestion {
  return q.question_type === 'code';
}

// Answer types
export type MultipleChoiceAnswer = string;
export type TrueFalseAnswer = boolean;
export type FillBlankAnswer = string[];
export type MatchingAnswer = Record<string, string>; // leftId -> rightId
export type OrderingAnswer = string[]; // ordered item ids
export type CodeAnswer = string; // code string

export type QuestionAnswer =
  | MultipleChoiceAnswer
  | TrueFalseAnswer
  | FillBlankAnswer
  | MatchingAnswer
  | OrderingAnswer
  | CodeAnswer;

// Validation helpers
export function validateAnswer(question: Question, answer: QuestionAnswer): boolean {
  switch (question.question_type) {
    case 'multiple_choice':
      return answer === question.correct_answer;

    case 'true_false':
      return answer === question.correct_answer;

    case 'fill_blank': {
      const q = question as FillBlankQuestion;
      const answers = answer as FillBlankAnswer;
      return q.blanks.every((blank, i) => {
        const userAnswer = answers[i] || '';
        const correctAnswer = q.case_sensitive ? blank : blank.toLowerCase();
        const userNormalized = q.case_sensitive ? userAnswer : userAnswer.toLowerCase();

        if (userNormalized === correctAnswer) return true;

        // Check alternatives
        const alts = q.accept_alternatives?.[i] || [];
        return alts.some((alt) =>
          q.case_sensitive ? userAnswer === alt : userAnswer.toLowerCase() === alt.toLowerCase()
        );
      });
    }

    case 'matching': {
      const q = question as MatchingQuestion;
      const ans = answer as MatchingAnswer;
      return q.pairs.every((pair) => ans[pair.id] === pair.id);
    }

    case 'ordering': {
      const q = question as OrderingQuestion;
      const ans = answer as OrderingAnswer;
      return q.correct_order.every((id, i) => ans[i] === id);
    }

    case 'code':
      // Code validation requires backend execution
      return false;

    default:
      return false;
  }
}
```

**Step 2: Update types index**

Add to `mobile/types/index.ts`:
```typescript
export * from './questions';
```

**Step 3: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add types/questions.ts types/index.ts && git commit -m "feat(content): add extended question type definitions"
```

---

## Task 3: Create True/False Question Card

**Files:**
- Create: `mobile/components/questions/TrueFalseCard.tsx`

**Step 1: Create the component**

Create `mobile/components/questions/TrueFalseCard.tsx`:
```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/providers/ThemeProvider';
import { TrueFalseQuestion } from '@/types/questions';

interface TrueFalseCardProps {
  question: TrueFalseQuestion;
  onAnswer: (answer: boolean) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  disabled?: boolean;
  selectedAnswer?: boolean | null;
}

export function TrueFalseCard({
  question,
  onAnswer,
  showFeedback = false,
  isCorrect,
  disabled = false,
  selectedAnswer,
}: TrueFalseCardProps) {
  const { colors, isDark } = useTheme();
  const [selected, setSelected] = useState<boolean | null>(selectedAnswer ?? null);

  const handleSelect = (value: boolean) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(value);
    onAnswer(value);
  };

  const getButtonStyle = (value: boolean) => {
    const isSelected = selected === value;
    const isCorrectAnswer = question.correct_answer === value;

    if (showFeedback) {
      if (isCorrectAnswer) {
        return {
          bg: colors.successLight,
          border: colors.success,
          icon: colors.success,
        };
      }
      if (isSelected && !isCorrectAnswer) {
        return {
          bg: colors.errorLight,
          border: colors.error,
          icon: colors.error,
        };
      }
    }

    if (isSelected) {
      return {
        bg: colors.brandLight,
        border: colors.brand,
        icon: colors.brand,
      };
    }

    return {
      bg: isDark ? '#1F2937' : '#FFFFFF',
      border: colors.border,
      icon: colors.textMuted,
    };
  };

  const trueStyle = getButtonStyle(true);
  const falseStyle = getButtonStyle(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.statement, { color: colors.textPrimary }]}>
        {question.statement}
      </Text>

      <View style={styles.buttons}>
        <Pressable
          onPress={() => handleSelect(true)}
          disabled={disabled}
          style={[
            styles.button,
            {
              backgroundColor: trueStyle.bg,
              borderColor: trueStyle.border,
            },
          ]}
        >
          <Check size={32} color={trueStyle.icon} />
          <Text style={[styles.buttonText, { color: trueStyle.icon }]}>
            TRUE
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleSelect(false)}
          disabled={disabled}
          style={[
            styles.button,
            {
              backgroundColor: falseStyle.bg,
              borderColor: falseStyle.border,
            },
          ]}
        >
          <X size={32} color={falseStyle.icon} />
          <Text style={[styles.buttonText, { color: falseStyle.icon }]}>
            FALSE
          </Text>
        </Pressable>
      </View>

      {showFeedback && question.explanation && (
        <View style={[styles.explanation, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
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
  statement: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 32,
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 1,
  },
  explanation: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/questions/TrueFalseCard.tsx && git commit -m "feat(content): add TrueFalseCard component"
```

---

## Task 4: Create Fill-in-the-Blank Card

**Files:**
- Create: `mobile/components/questions/FillBlankCard.tsx`

**Step 1: Create the component**

Create `mobile/components/questions/FillBlankCard.tsx`:
```typescript
import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { FillBlankQuestion } from '@/types/questions';

interface FillBlankCardProps {
  question: FillBlankQuestion;
  onAnswer: (answers: string[]) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  disabled?: boolean;
}

export function FillBlankCard({
  question,
  onAnswer,
  showFeedback = false,
  disabled = false,
}: FillBlankCardProps) {
  const { colors, isDark } = useTheme();
  const [answers, setAnswers] = useState<string[]>(
    new Array(question.blanks.length).fill('')
  );
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Split text by blanks (marked as ___ or [blank])
  const parts = question.text.split(/___|\[blank\]/gi);

  const handleChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
    onAnswer(newAnswers);
  };

  const handleSubmitEditing = (index: number) => {
    if (index < question.blanks.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const isBlankCorrect = (index: number): boolean => {
    const userAnswer = answers[index];
    const correctAnswer = question.blanks[index];

    const normalize = (s: string) =>
      question.case_sensitive ? s.trim() : s.trim().toLowerCase();

    if (normalize(userAnswer) === normalize(correctAnswer)) return true;

    const alts = question.accept_alternatives?.[index] || [];
    return alts.some((alt) => normalize(userAnswer) === normalize(alt));
  };

  const renderContent = () => {
    const elements: React.ReactNode[] = [];

    parts.forEach((part, partIndex) => {
      // Add text part
      if (part) {
        elements.push(
          <Text
            key={`text-${partIndex}`}
            style={[styles.text, { color: colors.textPrimary }]}
          >
            {part}
          </Text>
        );
      }

      // Add input if not last part
      if (partIndex < parts.length - 1) {
        const blankIndex = partIndex;
        const correct = showFeedback && isBlankCorrect(blankIndex);
        const incorrect = showFeedback && !isBlankCorrect(blankIndex);

        elements.push(
          <TextInput
            key={`input-${blankIndex}`}
            ref={(ref) => (inputRefs.current[blankIndex] = ref)}
            value={answers[blankIndex]}
            onChangeText={(value) => handleChange(blankIndex, value)}
            onSubmitEditing={() => handleSubmitEditing(blankIndex)}
            editable={!disabled}
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#374151' : '#F9FAFB',
                borderColor: correct
                  ? colors.success
                  : incorrect
                  ? colors.error
                  : colors.border,
                color: colors.textPrimary,
              },
            ]}
            placeholder="..."
            placeholderTextColor={colors.textMuted}
            returnKeyType={
              blankIndex < question.blanks.length - 1 ? 'next' : 'done'
            }
            autoCapitalize="none"
            autoCorrect={false}
          />
        );
      }
    });

    return elements;
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>{renderContent()}</View>

      {showFeedback && (
        <View style={styles.answerList}>
          <Text style={[styles.answerLabel, { color: colors.textSecondary }]}>
            Correct answers:
          </Text>
          {question.blanks.map((blank, i) => (
            <Text
              key={i}
              style={[styles.correctAnswer, { color: colors.success }]}
            >
              {i + 1}. {blank}
            </Text>
          ))}
        </View>
      )}

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
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    lineHeight: 32,
  },
  input: {
    minWidth: 80,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    fontSize: 16,
    marginHorizontal: 4,
    marginVertical: 4,
    textAlign: 'center',
  },
  answerList: {
    marginTop: 24,
  },
  answerLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  correctAnswer: {
    fontSize: 14,
    fontWeight: '500',
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
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/questions/FillBlankCard.tsx && git commit -m "feat(content): add FillBlankCard component"
```

---

## Task 5: Create Matching Card

**Files:**
- Create: `mobile/components/questions/MatchingCard.tsx`

**Step 1: Create the component**

Create `mobile/components/questions/MatchingCard.tsx`:
```typescript
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/providers/ThemeProvider';
import { MatchingQuestion } from '@/types/questions';
import { Button } from '@/components/ui';

interface MatchingCardProps {
  question: MatchingQuestion;
  onAnswer: (matches: Record<string, string>) => void;
  showFeedback?: boolean;
  disabled?: boolean;
}

export function MatchingCard({
  question,
  onAnswer,
  showFeedback = false,
  disabled = false,
}: MatchingCardProps) {
  const { colors, isDark } = useTheme();
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});

  // Shuffle right side options
  const shuffledRight = useMemo(() => {
    const items = question.pairs.map((p) => ({ id: p.id, text: p.right }));
    return items.sort(() => Math.random() - 0.5);
  }, [question.pairs]);

  const handleLeftPress = (id: string) => {
    if (disabled || matches[id]) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLeft(selectedLeft === id ? null : id);
  };

  const handleRightPress = (rightId: string) => {
    if (disabled || !selectedLeft) return;
    if (Object.values(matches).includes(rightId)) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newMatches = { ...matches, [selectedLeft]: rightId };
    setMatches(newMatches);
    setSelectedLeft(null);
    onAnswer(newMatches);
  };

  const handleReset = () => {
    setMatches({});
    setSelectedLeft(null);
    onAnswer({});
  };

  const getLeftItemStyle = (id: string) => {
    const isMatched = matches[id];
    const isSelected = selectedLeft === id;
    const isCorrect = showFeedback && matches[id] === id;
    const isIncorrect = showFeedback && matches[id] && matches[id] !== id;

    if (isCorrect) {
      return { bg: colors.successLight, border: colors.success };
    }
    if (isIncorrect) {
      return { bg: colors.errorLight, border: colors.error };
    }
    if (isMatched) {
      return { bg: colors.brandLight, border: colors.brand };
    }
    if (isSelected) {
      return { bg: colors.brandLight, border: colors.brand };
    }
    return {
      bg: isDark ? '#1F2937' : '#FFFFFF',
      border: colors.border,
    };
  };

  const getRightItemStyle = (rightId: string) => {
    const matchedBy = Object.entries(matches).find(([, v]) => v === rightId)?.[0];
    const isCorrect = showFeedback && matchedBy === rightId;
    const isIncorrect = showFeedback && matchedBy && matchedBy !== rightId;

    if (isCorrect) {
      return { bg: colors.successLight, border: colors.success };
    }
    if (isIncorrect) {
      return { bg: colors.errorLight, border: colors.error };
    }
    if (matchedBy) {
      return { bg: colors.brandLight, border: colors.brand };
    }
    return {
      bg: isDark ? '#1F2937' : '#FFFFFF',
      border: colors.border,
    };
  };

  return (
    <View style={styles.container}>
      {question.instruction && (
        <Text style={[styles.instruction, { color: colors.textSecondary }]}>
          {question.instruction}
        </Text>
      )}

      <View style={styles.columns}>
        {/* Left column */}
        <View style={styles.column}>
          {question.pairs.map((pair) => {
            const style = getLeftItemStyle(pair.id);
            return (
              <Pressable
                key={pair.id}
                onPress={() => handleLeftPress(pair.id)}
                style={[
                  styles.item,
                  { backgroundColor: style.bg, borderColor: style.border },
                ]}
              >
                <Text style={[styles.itemText, { color: colors.textPrimary }]}>
                  {pair.left}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Right column */}
        <View style={styles.column}>
          {shuffledRight.map((item) => {
            const style = getRightItemStyle(item.id);
            const isUsed = Object.values(matches).includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => handleRightPress(item.id)}
                disabled={isUsed || !selectedLeft}
                style={[
                  styles.item,
                  { backgroundColor: style.bg, borderColor: style.border },
                  isUsed && !showFeedback && styles.itemUsed,
                ]}
              >
                <Text style={[styles.itemText, { color: colors.textPrimary }]}>
                  {item.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {Object.keys(matches).length > 0 && !disabled && (
        <Button
          variant="ghost"
          size="sm"
          icon={RotateCcw}
          onPress={handleReset}
          className="mt-4"
        >
          Reset
        </Button>
      )}

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
    textAlign: 'center',
  },
  columns: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  item: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  itemUsed: {
    opacity: 0.5,
  },
  itemText: {
    fontSize: 14,
    textAlign: 'center',
  },
  explanation: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/questions/MatchingCard.tsx && git commit -m "feat(content): add MatchingCard component"
```

---

## Task 6: Create Ordering Card

**Files:**
- Create: `mobile/components/questions/OrderingCard.tsx`

**Step 1: Create the component**

Create `mobile/components/questions/OrderingCard.tsx`:
```typescript
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
                ? colors.brandLight
                : correct
                ? colors.successLight
                : incorrect
                ? colors.errorLight
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
          <View style={styles.indexBadge}>
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
    backgroundColor: '#F3F4F6',
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
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/questions/OrderingCard.tsx && git commit -m "feat(content): add OrderingCard with drag-to-reorder"
```

---

## Task 7: Create Question Renderer

**Files:**
- Create: `mobile/components/questions/QuestionRenderer.tsx`
- Create: `mobile/components/questions/index.ts`

**Step 1: Create QuestionRenderer**

Create `mobile/components/questions/QuestionRenderer.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import {
  Question,
  QuestionAnswer,
  isMultipleChoice,
  isTrueFalse,
  isFillBlank,
  isMatching,
  isOrdering,
  isCode,
} from '@/types/questions';
import { TrueFalseCard } from './TrueFalseCard';
import { FillBlankCard } from './FillBlankCard';
import { MatchingCard } from './MatchingCard';
import { OrderingCard } from './OrderingCard';
// Import existing MultipleChoiceCard from game components
// import { MultipleChoiceCard } from './MultipleChoiceCard';

interface QuestionRendererProps {
  question: Question;
  onAnswer: (answer: QuestionAnswer) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  disabled?: boolean;
}

export function QuestionRenderer({
  question,
  onAnswer,
  showFeedback = false,
  isCorrect,
  disabled = false,
}: QuestionRendererProps) {
  const { colors, isDark } = useTheme();

  if (isTrueFalse(question)) {
    return (
      <TrueFalseCard
        question={question}
        onAnswer={onAnswer}
        showFeedback={showFeedback}
        isCorrect={isCorrect}
        disabled={disabled}
      />
    );
  }

  if (isFillBlank(question)) {
    return (
      <FillBlankCard
        question={question}
        onAnswer={onAnswer}
        showFeedback={showFeedback}
        disabled={disabled}
      />
    );
  }

  if (isMatching(question)) {
    return (
      <MatchingCard
        question={question}
        onAnswer={onAnswer}
        showFeedback={showFeedback}
        disabled={disabled}
      />
    );
  }

  if (isOrdering(question)) {
    return (
      <OrderingCard
        question={question}
        onAnswer={onAnswer}
        showFeedback={showFeedback}
        disabled={disabled}
      />
    );
  }

  if (isCode(question)) {
    // Code questions need a more complex editor - placeholder for now
    return (
      <View style={[styles.placeholder, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
          Code questions require a code editor. Coming soon!
        </Text>
      </View>
    );
  }

  if (isMultipleChoice(question)) {
    // For multiple choice, we can reuse the existing game QuestionCard
    // or create a dedicated component
    return (
      <View style={[styles.placeholder, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
          Use existing QuestionCard for multiple choice
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.placeholder, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
      <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
        Unknown question type: {question.question_type}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    padding: 24,
    borderRadius: 12,
    margin: 16,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
```

**Step 2: Create index file**

Create `mobile/components/questions/index.ts`:
```typescript
export { TrueFalseCard } from './TrueFalseCard';
export { FillBlankCard } from './FillBlankCard';
export { MatchingCard } from './MatchingCard';
export { OrderingCard } from './OrderingCard';
export { QuestionRenderer } from './QuestionRenderer';
```

**Step 3: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/questions/ && git commit -m "feat(content): add QuestionRenderer with type routing"
```

---

## Task 8: Complete PDF Upload

**Files:**
- Modify: `mobile/app/(student)/create.tsx`

**Step 1: Add PDF upload functionality**

Read the current `create.tsx` file, then add:
1. Import `expo-file-system` and `expo-document-picker`
2. Add PDF upload handler function
3. Add processing state and UI
4. Remove "Coming Soon" label from PDF button

The PDF handler should:
```typescript
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

async function handlePDFUpload() {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });

  if (result.canceled) return;

  const file = result.assets[0];

  // Check file size (limit to 10MB)
  const fileInfo = await FileSystem.getInfoAsync(file.uri);
  if (fileInfo.exists && fileInfo.size && fileInfo.size > 10 * 1024 * 1024) {
    Alert.alert('File Too Large', 'Please select a PDF under 10MB');
    return;
  }

  setIsProcessingPDF(true);

  try {
    const base64 = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const response = await aiApi.chatGenerate({
      message: 'Generate quiz questions from this PDF document',
      pdf_base64: base64,
    }, token);

    // Add generated questions
    setQuestions((prev) => [...prev, ...response.questions]);
    setIsProcessingPDF(false);
  } catch (error) {
    setIsProcessingPDF(false);
    Alert.alert('Error', 'Failed to process PDF. Please try again.');
  }
}
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add app/\(student\)/create.tsx && git commit -m "feat(content): complete PDF upload functionality"
```

---

## Summary

Track 3 (Content) is complete when all tasks pass. The following are now available:

- **Question Types:** Extended type definitions with validation
- **TrueFalseCard:** Large TRUE/FALSE buttons
- **FillBlankCard:** Inline text inputs for blanks
- **MatchingCard:** Tap-to-match with visual feedback
- **OrderingCard:** Drag-to-reorder with haptics
- **QuestionRenderer:** Routes questions to correct component
- **PDF Upload:** Full document-to-quiz generation

The AI generation backend will need updates to output the correct schema for new question types.
