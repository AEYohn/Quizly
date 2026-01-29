export type AppEvent =
  | { type: 'QUIZ_COMPLETED'; payload: { quizId: string; score: number; perfect: boolean } }
  | { type: 'CARD_REVIEWED'; payload: { cardId: string; quality: number } }
  | { type: 'QUIZ_CREATED'; payload: { quizId: string } }
  | { type: 'DAILY_LOGIN'; payload: { date: string } }
  | { type: 'ACHIEVEMENT_UNLOCKED'; payload: { achievementId: string } }
  | { type: 'LEVEL_UP'; payload: { newLevel: number } }
  | { type: 'STREAK_UPDATED'; payload: { streak: number; maintained: boolean } };

export type AppEventType = AppEvent['type'];

export type AppEventListener<T extends AppEventType = AppEventType> = (
  event: Extract<AppEvent, { type: T }>
) => void;
