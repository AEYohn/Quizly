import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Code, Play, Info } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { CodeQuestion } from '@/types/questions';
import { Button } from '@/components/ui';

interface CodeChallengeCardProps {
  question: CodeQuestion;
  onAnswer: (code: string) => void;
  showFeedback?: boolean;
  disabled?: boolean;
}

export function CodeChallengeCard({
  question,
  onAnswer,
  showFeedback = false,
  disabled = false,
}: CodeChallengeCardProps) {
  const { colors, isDark } = useTheme();
  const [code, setCode] = useState(question.starter_code || '');

  const handleCodeChange = (value: string) => {
    setCode(value);
    onAnswer(value);
  };

  const languageColors: Record<string, string> = {
    python: '#3776AB',
    javascript: '#F7DF1E',
    typescript: '#3178C6',
    sql: '#336791',
    java: '#007396',
  };

  const languageColor = languageColors[question.language] || colors.brand;

  // Count visible test cases
  const visibleTestCases = question.test_cases.filter(tc => !tc.is_hidden);
  const hiddenCount = question.test_cases.length - visibleTestCases.length;

  return (
    <ScrollView style={styles.container}>
      {/* Language badge */}
      <View style={styles.header}>
        <View style={[styles.languageBadge, { backgroundColor: languageColor }]}>
          <Code size={14} color="#FFFFFF" />
          <Text style={styles.languageText}>
            {question.language.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.points, { color: colors.textMuted }]}>
          {question.points} pts
        </Text>
      </View>

      {/* Prompt */}
      <Text style={[styles.prompt, { color: colors.textPrimary }]}>
        {question.prompt}
      </Text>

      {/* Code editor */}
      <View style={[styles.editorContainer, { backgroundColor: isDark ? '#0D1117' : '#1E1E1E' }]}>
        <View style={styles.editorHeader}>
          <Text style={styles.editorTitle}>Your Code</Text>
        </View>
        <TextInput
          style={[styles.codeInput, { color: '#E6EDF3' }]}
          value={code}
          onChangeText={handleCodeChange}
          multiline
          editable={!disabled}
          placeholder={`// Write your ${question.language} code here...`}
          placeholderTextColor="#6E7681"
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
      </View>

      {/* Test cases preview */}
      {visibleTestCases.length > 0 && (
        <View style={styles.testCasesSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Test Cases
          </Text>
          {visibleTestCases.map((testCase, index) => (
            <View
              key={index}
              style={[styles.testCase, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: colors.border }]}
            >
              <View style={styles.testCaseRow}>
                <Text style={[styles.testCaseLabel, { color: colors.textMuted }]}>
                  Input:
                </Text>
                <Text style={[styles.testCaseValue, { color: colors.textPrimary }]}>
                  {testCase.input}
                </Text>
              </View>
              <View style={styles.testCaseRow}>
                <Text style={[styles.testCaseLabel, { color: colors.textMuted }]}>
                  Expected:
                </Text>
                <Text style={[styles.testCaseValue, { color: colors.textPrimary }]}>
                  {testCase.expected_output}
                </Text>
              </View>
            </View>
          ))}
          {hiddenCount > 0 && (
            <Text style={[styles.hiddenNote, { color: colors.textMuted }]}>
              + {hiddenCount} hidden test case{hiddenCount > 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}

      {/* Note about execution */}
      {!showFeedback && (
        <View style={[styles.infoBox, { backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF', borderColor: isDark ? '#1E40AF' : '#BFDBFE' }]}>
          <Info size={16} color={isDark ? '#60A5FA' : '#2563EB'} />
          <Text style={[styles.infoText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>
            Code will be evaluated when you submit the quiz
          </Text>
        </View>
      )}

      {/* Feedback - show solution if available */}
      {showFeedback && question.solution && (
        <View style={styles.solutionSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Sample Solution
          </Text>
          <View style={[styles.editorContainer, { backgroundColor: isDark ? '#0D1117' : '#1E1E1E' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text style={styles.solutionCode}>
                {question.solution}
              </Text>
            </ScrollView>
          </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  languageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  languageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  points: {
    fontSize: 14,
    fontWeight: '500',
  },
  prompt: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  editorContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  editorHeader: {
    backgroundColor: '#161B22',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  editorTitle: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '500',
  },
  codeInput: {
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
    minHeight: 150,
  },
  testCasesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  testCase: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  testCaseRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  testCaseLabel: {
    fontSize: 12,
    width: 70,
  },
  testCaseValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
  },
  hiddenNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
  },
  solutionSection: {
    marginTop: 16,
  },
  solutionCode: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 18,
    color: '#E6EDF3',
    padding: 12,
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
