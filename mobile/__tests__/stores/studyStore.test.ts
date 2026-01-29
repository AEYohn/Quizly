import { useStudyStore } from '@/stores/studyStore';
import { act } from '@testing-library/react-native';

describe('studyStore', () => {
  beforeEach(() => {
    useStudyStore.getState().reset();
  });

  describe('SM-2 algorithm', () => {
    it('should create new card review with default values', () => {
      const { initializeCard } = useStudyStore.getState();

      initializeCard('card-1', 'quiz-1');

      const reviews = useStudyStore.getState().cardReviews;
      expect(reviews['card-1']).toBeDefined();
      expect(reviews['card-1'].easeFactor).toBe(2.5);
      expect(reviews['card-1'].interval).toBe(0);
      expect(reviews['card-1'].repetitions).toBe(0);
    });

    it('should reset card on quality < 3', () => {
      const { initializeCard, recordReview } = useStudyStore.getState();

      initializeCard('card-1', 'quiz-1');
      // First make it have some progress
      recordReview('card-1', 4);
      recordReview('card-1', 4);
      // Then fail it
      recordReview('card-1', 2);

      const card = useStudyStore.getState().cardReviews['card-1'];
      expect(card.repetitions).toBe(0);
      expect(card.interval).toBe(1);
    });

    it('should increase interval on quality >= 3', () => {
      const { initializeCard, recordReview } = useStudyStore.getState();

      initializeCard('card-1', 'quiz-1');
      recordReview('card-1', 4);

      const card = useStudyStore.getState().cardReviews['card-1'];
      expect(card.repetitions).toBe(1);
      expect(card.interval).toBe(1);
    });
  });

  describe('getDueCards', () => {
    it('should return cards due for review', () => {
      const { initializeCard, getDueCards } = useStudyStore.getState();

      initializeCard('card-1', 'quiz-1');
      initializeCard('card-2', 'quiz-1');

      const dueCards = getDueCards();
      expect(dueCards.length).toBe(2);
    });
  });
});
