import type { ScrollCard } from "@/types/learn";
import { MCQCard } from "./MCQCard";
import { FlashcardCard } from "./FlashcardCard";
import { InfoCard } from "./InfoCard";
import { ResourceCard } from "./ResourceCard";

interface CardRendererProps {
  card: ScrollCard;
  result: { isCorrect: boolean; xpEarned: number; streakBroken: boolean } | null;
  flashcardXp: number | null;
  infoAcknowledged: boolean;
  onAnswer: (answer: string) => void;
  onNext: () => void;
  onHelp: () => void;
  onFlashcardRate: (rating: number) => void;
  onInfoGotIt: () => void;
}

export function CardRenderer({
  card,
  result,
  flashcardXp,
  infoAcknowledged,
  onAnswer,
  onNext,
  onHelp,
  onFlashcardRate,
  onInfoGotIt,
}: CardRendererProps) {
  switch (card.card_type) {
    case "flashcard":
      return (
        <FlashcardCard
          key={card.content_item_id}
          card={card}
          xpEarned={flashcardXp}
          onRate={onFlashcardRate}
          onNext={onNext}
        />
      );
    case "info_card":
    case "info":
      return (
        <InfoCard
          key={card.content_item_id}
          card={card}
          acknowledged={infoAcknowledged}
          onGotIt={onInfoGotIt}
          onNext={onNext}
        />
      );
    case "resource_card":
    case "resource":
      return <ResourceCard key={card.content_item_id} card={card} onNext={onNext} />;
    default:
      // MCQ / question
      return (
        <MCQCard
          key={card.content_item_id}
          card={card}
          result={result}
          onAnswer={onAnswer}
          onNext={onNext}
          onHelp={onHelp}
        />
      );
  }
}
