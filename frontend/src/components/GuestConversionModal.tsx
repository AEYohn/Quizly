"use client";

import { X, Sparkles, BookOpen, Layers, ClipboardList, ArrowRight } from "lucide-react";

interface ExitTicket {
    id: string;
    student_name: string;
    target_concept: string;
    micro_lesson: string;
    study_notes?: {
        key_concepts?: string[];
        common_mistakes?: string[];
        strategies?: string[];
        memory_tips?: string[];
    };
    practice_questions?: {
        prompt: string;
        options: string[];
        correct_answer: string;
    }[];
    flashcards?: { front: string; back: string }[];
}

interface GuestConversionModalProps {
    exitTicket: ExitTicket;
    onClose: () => void;
    onSignUp: () => void;
}

export function GuestConversionModal({ exitTicket, onClose, onSignUp }: GuestConversionModalProps) {
    const flashcardCount = exitTicket.flashcards?.length || 0;
    const practiceCount = exitTicket.practice_questions?.length || 0;
    const hasStudyNotes = exitTicket.study_notes && (
        (exitTicket.study_notes.key_concepts?.length || 0) > 0 ||
        (exitTicket.study_notes.strategies?.length || 0) > 0
    );

    const handleSignUp = () => {
        // Store exit ticket ID so it can be linked after sign-up
        if (exitTicket.id) {
            localStorage.setItem("quizly_pending_exit_ticket_id", exitTicket.id);
        }
        onSignUp();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Gradient header */}
                <div className="bg-gradient-to-br from-sky-600 via-teal-600 to-pink-600 p-6 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Your Study Materials Are Ready!
                    </h2>
                    <p className="text-white/80">
                        We created personalized resources just for you
                    </p>
                </div>

                {/* Content summary */}
                <div className="p-6">
                    <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 border border-gray-700">
                            <div className="p-2 rounded-lg bg-amber-500/20">
                                <BookOpen className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <p className="font-medium text-white">Micro-Lesson</p>
                                <p className="text-sm text-gray-400">{exitTicket.target_concept}</p>
                            </div>
                        </div>

                        {practiceCount > 0 && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 border border-gray-700">
                                <div className="p-2 rounded-lg bg-sky-500/20">
                                    <ClipboardList className="w-5 h-5 text-sky-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-white">{practiceCount} Practice Questions</p>
                                    <p className="text-sm text-gray-400">Revision to reinforce learning</p>
                                </div>
                            </div>
                        )}

                        {flashcardCount > 0 && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 border border-gray-700">
                                <div className="p-2 rounded-lg bg-teal-500/20">
                                    <Layers className="w-5 h-5 text-teal-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-white">{flashcardCount} Flashcards</p>
                                    <p className="text-sm text-gray-400">For quick review</p>
                                </div>
                            </div>
                        )}

                        {hasStudyNotes && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 border border-gray-700">
                                <div className="p-2 rounded-lg bg-emerald-500/20">
                                    <BookOpen className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-white">Study Notes</p>
                                    <p className="text-sm text-gray-400">Key concepts & strategies</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CTA */}
                    <div className="space-y-3">
                        <button
                            onClick={handleSignUp}
                            className="w-full py-4 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2"
                        >
                            Save My Progress
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 text-gray-400 hover:text-white font-medium transition-colors"
                        >
                            Continue as Guest
                        </button>
                    </div>

                    <p className="mt-4 text-center text-xs text-gray-500">
                        Create a free account to access your materials anytime
                    </p>
                </div>
            </div>
        </div>
    );
}
