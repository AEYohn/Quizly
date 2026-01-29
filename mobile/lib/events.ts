import { AppEvent, AppEventType, AppEventListener } from '@/types/events';

class EventBus {
  private listeners: Map<AppEventType, Set<AppEventListener<any>>> = new Map();

  on<T extends AppEventType>(
    eventType: T,
    listener: AppEventListener<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const listenersSet = this.listeners.get(eventType)!;
    listenersSet.add(listener);

    return () => {
      listenersSet.delete(listener);
    };
  }

  emit(event: AppEvent): void {
    const listenersSet = this.listeners.get(event.type);
    if (listenersSet) {
      listenersSet.forEach((listener) => {
        listener(event);
      });
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
