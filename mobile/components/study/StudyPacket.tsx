import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { useState } from "react";
import { Card, Button } from "@/components/ui";
import { Flashcard } from "./Flashcard";
import {
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Layers,
  FileText,
} from "lucide-react-native";

interface MissedQuestion {
  question: string;
  yourAnswer: string;
  correctAnswer: string;
  explanation?: string;
  options?: Record<string, string>;
}

interface StudyPacketProps {
  visible: boolean;
  onClose: () => void;
  quizTitle: string;
  missedQuestions: MissedQuestion[];
  allQuestions?: MissedQuestion[];
}

type PacketTab = "missed" | "all" | "notes";

export function StudyPacket({
  visible,
  onClose,
  quizTitle,
  missedQuestions,
  allQuestions,
}: StudyPacketProps) {
  const [activeTab, setActiveTab] = useState<PacketTab>("missed");
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "flashcards">("list");

  const currentQuestions =
    activeTab === "missed" ? missedQuestions : allQuestions || missedQuestions;

  const handleNextCard = () => {
    if (currentCardIndex < currentQuestions.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
    }
  };

  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex((prev) => prev - 1);
    }
  };

  const renderList = () => (
    <ScrollView className="flex-1" contentContainerClassName="px-4 py-4">
      {currentQuestions.length === 0 ? (
        <View className="items-center py-12">
          <Text className="text-6xl mb-4">🎉</Text>
          <Text className="text-xl font-bold text-gray-900 mb-2">
            Perfect Score!
          </Text>
          <Text className="text-gray-500 text-center">
            You got all questions correct. Great job!
          </Text>
        </View>
      ) : (
        <>
          <Text className="text-gray-500 mb-4">
            {activeTab === "missed"
              ? `Review ${currentQuestions.length} missed questions`
              : `All ${currentQuestions.length} questions`}
          </Text>

          {currentQuestions.map((q, index) => (
            <Card
              key={index}
              variant="outline"
              className={`mb-3 ${
                activeTab === "missed" ? "border-l-4 border-l-red-500" : ""
              }`}
            >
              <Text className="font-medium text-gray-900 mb-2">
                {q.question}
              </Text>

              {activeTab === "missed" && (
                <View className="mb-2">
                  <View className="flex-row items-center mb-1">
                    <X size={14} color="#EF4444" />
                    <Text className="text-red-600 text-sm ml-1">
                      Your answer: {q.yourAnswer}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-green-600 text-sm">
                      ✓ Correct: {q.correctAnswer}
                    </Text>
                  </View>
                </View>
              )}

              {activeTab === "all" && (
                <View className="bg-green-50 p-2 rounded-lg mb-2">
                  <Text className="text-green-700 text-sm">
                    Answer: {q.correctAnswer}
                  </Text>
                </View>
              )}

              {q.explanation && (
                <View className="bg-blue-50 p-2 rounded-lg">
                  <Text className="text-blue-700 text-sm">{q.explanation}</Text>
                </View>
              )}
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );

  const renderFlashcards = () => {
    if (currentQuestions.length === 0) {
      return (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-6xl mb-4">🎉</Text>
          <Text className="text-xl font-bold text-gray-900 mb-2">
            Nothing to Review
          </Text>
          <Text className="text-gray-500 text-center">
            You aced it! No missed questions.
          </Text>
        </View>
      );
    }

    const currentQ = currentQuestions[currentCardIndex];

    return (
      <View className="flex-1 justify-center items-center px-4">
        {/* Progress */}
        <View className="w-full mb-6">
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-500">
              Card {currentCardIndex + 1} of {currentQuestions.length}
            </Text>
          </View>
          <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-full bg-primary-500 rounded-full"
              style={{
                width: `${((currentCardIndex + 1) / currentQuestions.length) * 100}%`,
              }}
            />
          </View>
        </View>

        {/* Flashcard */}
        <Flashcard
          question={currentQ.question}
          answer={currentQ.correctAnswer}
          explanation={currentQ.explanation}
        />

        {/* Navigation */}
        <View className="flex-row items-center justify-between w-full mt-8 px-4">
          <Pressable
            onPress={handlePrevCard}
            disabled={currentCardIndex === 0}
            className={`w-14 h-14 rounded-full items-center justify-center ${
              currentCardIndex === 0
                ? "bg-gray-100"
                : "bg-gray-200 active:bg-gray-300"
            }`}
          >
            <ChevronLeft
              size={28}
              color={currentCardIndex === 0 ? "#D1D5DB" : "#374151"}
            />
          </Pressable>

          <Pressable
            onPress={handleNextCard}
            disabled={currentCardIndex === currentQuestions.length - 1}
            className={`w-14 h-14 rounded-full items-center justify-center ${
              currentCardIndex === currentQuestions.length - 1
                ? "bg-gray-100"
                : "bg-gray-200 active:bg-gray-300"
            }`}
          >
            <ChevronRight
              size={28}
              color={
                currentCardIndex === currentQuestions.length - 1
                  ? "#D1D5DB"
                  : "#374151"
              }
            />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-4 pt-4 pb-2">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-xl font-bold text-gray-900">
                Study Packet
              </Text>
              <Text className="text-gray-500 text-sm">{quizTitle}</Text>
            </View>
            <Pressable
              onPress={onClose}
              className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
            >
              <X size={20} color="#6B7280" />
            </Pressable>
          </View>

          {/* Tabs */}
          <View className="flex-row gap-2 mb-2">
            <Pressable
              onPress={() => {
                setActiveTab("missed");
                setCurrentCardIndex(0);
              }}
              className={`flex-1 py-2 px-3 rounded-lg flex-row items-center justify-center ${
                activeTab === "missed" ? "bg-red-100" : "bg-gray-100"
              }`}
            >
              <X
                size={16}
                color={activeTab === "missed" ? "#DC2626" : "#6B7280"}
              />
              <Text
                className={`ml-1 font-medium ${
                  activeTab === "missed" ? "text-red-700" : "text-gray-600"
                }`}
              >
                Missed ({missedQuestions.length})
              </Text>
            </Pressable>

            {allQuestions && (
              <Pressable
                onPress={() => {
                  setActiveTab("all");
                  setCurrentCardIndex(0);
                }}
                className={`flex-1 py-2 px-3 rounded-lg flex-row items-center justify-center ${
                  activeTab === "all" ? "bg-primary-100" : "bg-gray-100"
                }`}
              >
                <BookOpen
                  size={16}
                  color={activeTab === "all" ? "#4F46E5" : "#6B7280"}
                />
                <Text
                  className={`ml-1 font-medium ${
                    activeTab === "all" ? "text-primary-700" : "text-gray-600"
                  }`}
                >
                  All ({allQuestions.length})
                </Text>
              </Pressable>
            )}
          </View>

          {/* View Mode Toggle */}
          {currentQuestions.length > 0 && (
            <View className="flex-row bg-gray-100 rounded-lg p-1">
              <Pressable
                onPress={() => setViewMode("list")}
                className={`flex-1 py-2 rounded-md flex-row items-center justify-center ${
                  viewMode === "list" ? "bg-white shadow-sm" : ""
                }`}
              >
                <FileText
                  size={16}
                  color={viewMode === "list" ? "#4F46E5" : "#6B7280"}
                />
                <Text
                  className={`ml-1 font-medium ${
                    viewMode === "list" ? "text-primary-700" : "text-gray-600"
                  }`}
                >
                  List
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setViewMode("flashcards");
                  setCurrentCardIndex(0);
                }}
                className={`flex-1 py-2 rounded-md flex-row items-center justify-center ${
                  viewMode === "flashcards" ? "bg-white shadow-sm" : ""
                }`}
              >
                <Layers
                  size={16}
                  color={viewMode === "flashcards" ? "#4F46E5" : "#6B7280"}
                />
                <Text
                  className={`ml-1 font-medium ${
                    viewMode === "flashcards"
                      ? "text-primary-700"
                      : "text-gray-600"
                  }`}
                >
                  Cards
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Content */}
        {viewMode === "list" ? renderList() : renderFlashcards()}
      </View>
    </Modal>
  );
}
