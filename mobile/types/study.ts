export interface CardReview {
  cardId: string;
  visitorId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
  lastReviewDate: string;
}

export interface DailyStudyStats {
  date: string;
  cardsReviewed: number;
  correctCount: number;
  totalTime: number;
}

export interface StudySession {
  id: string;
  quizId: string;
  startedAt: string;
  cardsReviewed: string[];
  correctCount: number;
}

export interface StudyPacket {
  id: string;
  date: string;
  sections: StudyPacketSection[];
  totalCards: number;
  estimatedTime: number;
}

export interface StudyPacketSection {
  title: string;
  description: string;
  cardIds: string[];
  estimatedTime: number;
}
