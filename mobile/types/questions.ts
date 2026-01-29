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
