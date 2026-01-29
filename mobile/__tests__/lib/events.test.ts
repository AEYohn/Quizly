import { eventBus } from '@/lib/events';

describe('EventBus', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it('should emit and receive events', () => {
    const listener = jest.fn();
    eventBus.on('QUIZ_COMPLETED', listener);

    eventBus.emit({
      type: 'QUIZ_COMPLETED',
      payload: { quizId: '123', score: 100, perfect: true },
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'QUIZ_COMPLETED',
      payload: { quizId: '123', score: 100, perfect: true },
    });
  });

  it('should unsubscribe correctly', () => {
    const listener = jest.fn();
    const unsubscribe = eventBus.on('QUIZ_COMPLETED', listener);
    unsubscribe();

    eventBus.emit({
      type: 'QUIZ_COMPLETED',
      payload: { quizId: '123', score: 100, perfect: false },
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should only call listeners for matching event type', () => {
    const quizListener = jest.fn();
    const cardListener = jest.fn();

    eventBus.on('QUIZ_COMPLETED', quizListener);
    eventBus.on('CARD_REVIEWED', cardListener);

    eventBus.emit({
      type: 'QUIZ_COMPLETED',
      payload: { quizId: '123', score: 100, perfect: false },
    });

    expect(quizListener).toHaveBeenCalled();
    expect(cardListener).not.toHaveBeenCalled();
  });
});
