"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
    Zap,
    Flame,
    BarChart3,
    X,
    BookOpen,
    Target,
    TrendingUp,
    TrendingDown,
    Minus,
    Check,
    ArrowRight,
    RotateCcw,
    HelpCircle,
    Upload,
    Settings2,
    Search,
    ChevronLeft,
    Users,
    Clock,
    Sparkles,
    Play,
    AlertTriangle,
    Shield,
    Github,
    Loader2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { scrollApi, syllabusApi, curriculumApi, learnApi, resourcesApi, codebaseApi } from "~/lib/api";
import type { ScrollCard, ScrollStats, ScrollAnalytics, ScrollSessionAnalytics } from "~/lib/api";
import { useAuth, getStudentName } from "~/lib/auth";
import { FlashcardCard } from "~/components/learning/FlashcardCard";
import { InfoCardComponent } from "~/components/learning/InfoCardComponent";
import { ChatContainer } from "~/components/chat/ChatContainer";
import { ChatMessage } from "~/components/chat/ChatMessage";
import { ChatInput } from "~/components/chat/ChatInput";
import { AiThinkingIndicator } from "~/components/chat/AiThinkingIndicator";
import { ConfidenceSlider } from "~/components/learning/ConfidenceSlider";
import { useScrollSessionStore } from "~/stores/scrollSessionStore";
import type { SyllabusTopic, SyllabusTree } from "~/stores/scrollSessionStore";
import dynamic from "next/dynamic";
import { BottomSheet } from "~/components/feed/BottomSheet";
import { SkillTreeAnalysis } from "~/components/feed/SkillTreeAnalysis";
import { RichText, Explanation } from "~/components/shared/RichText";

// Lazy-load heavy sub-components behind modals / bottom sheets
const SkillTreePath = dynamic(
    () => import("~/components/feed/SkillTreePath").then((mod) => mod.SkillTreePath),
    {
        ssr: false,
        loading: () => (
            <div className="h-full flex items-center justify-center bg-gray-950" role="status" aria-label="Loading skill tree">
                <div className="animate-pulse space-y-4 w-full max-w-lg mx-auto px-4 py-8">
                    <div className="h-5 bg-gray-800 rounded w-48 mx-auto" />
                    <div className="space-y-6 pt-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-3 justify-center">
                                <div className="w-14 h-14 rounded-full bg-gray-800/60" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ),
    },
);

const FeedTuneControls = dynamic(
    () => import("~/components/feed/FeedTuneControls").then((mod) => mod.FeedTuneControls),
    {
        ssr: false,
        loading: () => (
            <div className="animate-pulse space-y-3 p-4" role="status" aria-label="Loading settings">
                <div className="h-8 bg-gray-800 rounded w-full" />
                <div className="h-8 bg-gray-800 rounded w-full" />
                <div className="h-8 bg-gray-800 rounded w-3/4" />
            </div>
        ),
    },
);

// ---------------------------------------------------------------------------
// Quiz card component
// ---------------------------------------------------------------------------

function QuizCard({
    card,
    onAnswer,
    onNext,
    onHelp,
    result,
    stats,
    analytics,
}: {
    card: ScrollCard;
    onAnswer: (answer: string, confidence: number) => void;
    onNext: () => void;
    onHelp: () => void;
    result: { isCorrect: boolean; xpEarned: number; streakBroken: boolean } | null;
    stats: ScrollStats;
    analytics: ScrollAnalytics | null;
}) {
    const [selected, setSelected] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [confidence, setConfidence] = useState(50);

    useEffect(() => {
        setSelected(null);
        setSubmitted(false);
        setConfidence(50);
    }, [card.id]);

    const handleSelect = (e: React.MouseEvent, letter: string) => {
        e.stopPropagation();
        if (submitted || result) return;
        setSelected((prev) => (prev === letter ? null : letter));
    };

    const handleSubmit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selected || submitted || result) return;
        setSubmitted(true);
        onAnswer(selected, confidence);
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        onNext();
    };

    const getOptionLetter = (opt: string): string => {
        const m = opt.match(/^([A-D])[.)]\s*/);
        return m?.[1] ?? opt[0] ?? "A";
    };
    const getOptionText = (opt: string) => opt.replace(/^[A-D][.)]\s*/, "");

    return (
        <div className="h-full w-full flex flex-col px-5 pt-4 pb-5 overflow-y-auto">
            {/* Concept + review badge + prove-it badge */}
            <div className="flex items-center gap-2 mb-5 shrink-0">
                {card.is_reintroduction && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <RotateCcw className="w-3 h-3" />
                        Review
                    </span>
                )}
                {card.card_type === "prove_it" && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <Shield className="w-3 h-3" />
                        Prove It
                    </span>
                )}
                <span className="text-[11px] font-medium text-gray-500 tracking-wide uppercase">{card.concept}</span>
            </div>

            {/* Question prompt */}
            <div className="mb-6 shrink-0">
                <RichText text={card.prompt} className="text-[17px] font-medium text-gray-100 leading-[1.6]" />
            </div>

            {/* Options */}
            <fieldset className="space-y-2.5 mb-5 shrink-0 border-none p-0 m-0">
                <legend className="sr-only">Answer options</legend>
                {card.options.map((option) => {
                    const letter = getOptionLetter(option);
                    const text = getOptionText(option);
                    const isSelected = selected === letter;
                    const isCorrectOption = result && letter === card.correct_answer;
                    const isWrongSelected = result && isSelected && !result.isCorrect;
                    const isUnrelated = result && !isCorrectOption && !isWrongSelected;

                    return (
                        <button
                            key={letter}
                            onClick={(e) => handleSelect(e, letter)}
                            disabled={!!result}
                            aria-pressed={isSelected}
                            className={cn(
                                "w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-200",
                                !result && !isSelected && "border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-800/50 active:scale-[0.98]",
                                !result && isSelected && "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30",
                                isCorrectOption && "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30",
                                isWrongSelected && "border-red-500 bg-red-500/10 ring-1 ring-red-500/30",
                                isUnrelated && "border-gray-800/50 bg-gray-900/20 opacity-40",
                            )}
                        >
                            <span
                                className={cn(
                                    "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors",
                                    !result && !isSelected && "bg-gray-800 text-gray-500",
                                    !result && isSelected && "bg-violet-500 text-white",
                                    isCorrectOption && "bg-emerald-500 text-white",
                                    isWrongSelected && "bg-red-500 text-white",
                                    isUnrelated && "bg-gray-800/50 text-gray-600",
                                )}
                            >
                                {isCorrectOption ? <Check className="w-3.5 h-3.5" /> :
                                 isWrongSelected ? <X className="w-3.5 h-3.5" /> : letter}
                            </span>
                            <span className={cn("text-sm leading-relaxed pt-0.5", isUnrelated ? "text-gray-600" : "text-gray-200")}>
                                <RichText text={text} />
                            </span>
                        </button>
                    );
                })}
            </fieldset>

            {/* Confidence slider (appears after selecting an option) */}
            {selected && !result && (
                <div className="mb-4 shrink-0">
                    <ConfidenceSlider value={confidence} onChange={setConfidence} />
                </div>
            )}

            {/* Check button + help link */}
            {!result && (
                <div className="space-y-2 shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={!selected}
                        className={cn(
                            "w-full py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200",
                            selected
                                ? "bg-violet-600 text-white hover:bg-violet-500 active:scale-[0.98]"
                                : "bg-gray-800/60 text-gray-600 cursor-not-allowed",
                        )}
                    >
                        Check Answer
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onHelp(); }}
                        className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1.5 transition-colors"
                    >
                        <HelpCircle className="w-3.5 h-3.5" />
                        I don&apos;t know — help me think through it
                    </button>
                </div>
            )}

            {/* Result section */}
            {result && (
                <div className="space-y-4 shrink-0">
                    <div
                        className={cn(
                            "flex items-center justify-between px-4 py-3.5 rounded-2xl",
                            result.isCorrect ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20",
                        )}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", result.isCorrect ? "bg-emerald-500/20" : "bg-red-500/20")}>
                                {result.isCorrect ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                            </div>
                            <div>
                                <div className={cn("text-sm font-semibold", result.isCorrect ? "text-emerald-400" : "text-red-400")}>
                                    {result.isCorrect ? "Correct!" : "Incorrect"}
                                </div>
                                {!result.isCorrect && (
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        Answer: <span className="text-gray-300 font-medium">{card.correct_answer}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {result.isCorrect && result.xpEarned > 0 && (
                            <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                                <Zap className="w-4 h-4" />
                                +{result.xpEarned}
                            </div>
                        )}
                    </div>

                    {result.streakBroken && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/5 border border-orange-500/10">
                            <Flame className="w-3.5 h-3.5 text-orange-400/60" />
                            <span className="text-xs text-orange-400/70">Streak lost — this question will come back later</span>
                        </div>
                    )}

                    {!result.isCorrect && analytics?.calibration_nudge && (
                        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <div className="text-xs font-semibold text-amber-400 mb-1">Calibration Check</div>
                                <p className="text-xs text-amber-300/70 leading-relaxed">{analytics.calibration_nudge.message}</p>
                            </div>
                        </div>
                    )}

                    {card.explanation && (
                        <div className="rounded-2xl bg-gray-900/60 border border-gray-800/60 p-4">
                            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-2.5">Explanation</div>
                            <Explanation text={card.explanation} />
                        </div>
                    )}

                    {analytics && (
                        <div className="flex items-center gap-4 px-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <Target className="w-3 h-3" />
                                {analytics.concept}: {analytics.concept_accuracy}%
                            </span>
                            <span className="flex items-center gap-1">
                                {analytics.difficulty_trend === "harder" ? (
                                    <TrendingUp className="w-3 h-3 text-violet-400" />
                                ) : analytics.difficulty_trend === "easier" ? (
                                    <TrendingDown className="w-3 h-3 text-amber-400" />
                                ) : (
                                    <Minus className="w-3 h-3" />
                                )}
                                Getting {analytics.difficulty_trend}
                            </span>
                        </div>
                    )}

                    <button
                        onClick={handleNext}
                        className={cn(
                            "w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]",
                            result.isCorrect ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-gray-800 text-gray-200 hover:bg-gray-700",
                        )}
                    >
                        <span className="flex items-center justify-center gap-2">
                            Continue
                            <ArrowRight className="w-4 h-4" />
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Analytics overlay
// ---------------------------------------------------------------------------

function AnalyticsOverlay({ data, onClose }: { data: ScrollSessionAnalytics; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 bg-gray-950/98 backdrop-blur-sm flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
                <h2 className="text-lg font-bold text-gray-100">Session Stats</h2>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-800 text-gray-400 transition-colors" aria-label="Close session stats">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="flex-1 p-5 space-y-6 max-w-lg mx-auto w-full">
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: "Accuracy", value: `${data.accuracy}%`, color: "text-gray-100" },
                        { label: "Total XP", value: data.total_xp, color: "text-amber-400" },
                        { label: "Best Streak", value: data.best_streak, color: "text-orange-400" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-4 text-center">
                            <div className={cn("text-2xl font-bold", color)}>{value}</div>
                            <div className="text-[11px] text-gray-500 mt-1 uppercase tracking-wide">{label}</div>
                        </div>
                    ))}
                </div>

                {data.improvement_areas.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-red-400 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                            <Target className="w-3.5 h-3.5" />Needs Work
                        </h3>
                        <div className="space-y-2">
                            {data.improvement_areas.map((area) => {
                                const concept = data.concepts.find((c) => c.concept === area);
                                return (
                                    <div key={area} className="flex items-center justify-between bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3">
                                        <span className="text-sm text-gray-200">{area}</span>
                                        <span className="text-xs font-medium text-red-400">{concept?.accuracy ?? 0}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {data.strengths.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-emerald-400 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                            <Target className="w-3.5 h-3.5" />Strengths
                        </h3>
                        <div className="space-y-2">
                            {data.strengths.map((area) => {
                                const concept = data.concepts.find((c) => c.concept === area);
                                return (
                                    <div key={area} className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3">
                                        <span className="text-sm text-gray-200">{area}</span>
                                        <span className="text-xs font-medium text-emerald-400">{concept?.accuracy ?? 0}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">All Concepts</h3>
                    <div className="space-y-2">
                        {data.concepts.map((c) => (
                            <div key={c.concept} className="bg-gray-900/60 border border-gray-800/40 rounded-xl px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-200">{c.concept}</span>
                                    <span className="text-xs text-gray-500">{c.attempts} Qs</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all",
                                                c.accuracy >= 80 ? "bg-emerald-500" : c.accuracy >= 50 ? "bg-amber-500" : "bg-red-500",
                                            )}
                                            style={{ width: `${c.accuracy}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-gray-400 w-10 text-right">{c.accuracy}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Socratic help overlay
// ---------------------------------------------------------------------------

function SocraticOverlay({ card, sessionId, onClose }: { card: ScrollCard; sessionId: string; onClose: () => void }) {
    const [messages, setMessages] = useState<{ role: "ai" | "student"; content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [readyToTry, setReadyToTry] = useState(false);

    const sendMessage = useCallback(
        async (text: string) => {
            setMessages((prev) => [...prev, { role: "student", content: text }]);
            setIsLoading(true);
            try {
                const res = await scrollApi.sendHelpMessage(sessionId, text, {
                    prompt: card.prompt,
                    concept: card.concept,
                    options: card.options,
                });
                if (res.success) {
                    setMessages((prev) => [...prev, { role: "ai", content: res.data.message }]);
                    setReadyToTry(res.data.ready_to_try);
                }
            } catch {
                setMessages((prev) => [...prev, { role: "ai", content: "Something went wrong. Try again?" }]);
            } finally {
                setIsLoading(false);
            }
        },
        [sessionId, card.prompt, card.concept, card.options],
    );

    const hasSentInitial = useRef(false);
    useEffect(() => {
        if (!hasSentInitial.current) {
            hasSentInitial.current = true;
            sendMessage("I don't know how to approach this question.");
        }
    }, [sendMessage]);

    const showReadyButton = readyToTry || messages.filter((m) => m.role === "student").length >= 3;

    return (
        <div className="fixed inset-0 z-50 bg-gray-950/98 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60 shrink-0">
                <div className="min-w-0">
                    <h2 className="text-sm font-bold text-gray-100 truncate">Help: {card.concept}</h2>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{card.prompt.slice(0, 60)}...</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-800 text-gray-400 transition-colors shrink-0 ml-3" aria-label="Close help">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <ChatContainer>
                {messages.map((msg, i) => (
                    <ChatMessage key={i} role={msg.role === "ai" ? "ai" : "student"} content={msg.content} agent={msg.role === "ai" ? "teach" : undefined} />
                ))}
                {isLoading && <AiThinkingIndicator />}
            </ChatContainer>
            {showReadyButton && (
                <div className="px-4 pb-2 shrink-0">
                    <button onClick={onClose} className="w-full py-3 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 active:scale-[0.98] transition-all">
                        I&apos;m ready to try answering
                    </button>
                </div>
            )}
            <div className="shrink-0">
                <ChatInput onSend={sendMessage} placeholder="Ask a question or share your thinking..." disabled={isLoading} />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main ScrollFeed component (store-driven)
// ---------------------------------------------------------------------------

export function ScrollFeed() {
    const auth = useAuth();
    const store = useScrollSessionStore();

    // PDF upload ref + state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isPdfUploading, setIsPdfUploading] = useState(false);

    // Local state not in store
    const [sessionAnalytics, setSessionAnalytics] = useState<ScrollSessionAnalytics | null>(null);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [showTuneSheet, setShowTuneSheet] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("Setting up your feed...");
    const [showResourceSheet, setShowResourceSheet] = useState(false);
    const [showRegenBanner, setShowRegenBanner] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);

    const answerStartTime = useRef(Date.now());

    // ----- FILE UPLOAD -----
    const handleFileUpload = useCallback(async (file: File) => {
        setUploadedFile(file);
        setIsProcessingFile(true);
        store.setError(null);
        try {
            const formData = new FormData();
            formData.append("files", file);
            const res = await curriculumApi.processMaterials(formData);
            if (res.success) {
                if (res.data.topic) store.setTopicInput(res.data.topic);
                const notesText = [
                    res.data.summary,
                    res.data.concepts.length ? "\n\nKey concepts: " + res.data.concepts.join(", ") : "",
                    res.data.objectives.length ? "\nObjectives: " + res.data.objectives.join("; ") : "",
                ].join("");
                store.setNotesInput(notesText);
                setShowNotes(true);
            } else {
                store.setError("Failed to process file: " + (res.error ?? "Unknown error"));
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Failed to process file");
        } finally {
            setIsProcessingFile(false);
        }
    }, [store]);

    // ----- PDF → SYLLABUS (home screen) -----
    const handlePdfToSyllabus = useCallback(async (files: FileList) => {
        setIsPdfUploading(true);
        store.setError(null);
        try {
            const formData = new FormData();
            Array.from(files).forEach((f) => formData.append("files", f));
            if (auth.user?.id) formData.append("student_id", auth.user.id);

            const res = await resourcesApi.pdfToSyllabus(formData);
            if (!res.success) {
                store.setError(res.error ?? "Failed to process document");
                return;
            }

            store.setSyllabus(res.data.syllabus);
            store.setSelectedSubject(res.data.subject);
            store.setSubjectResources(res.data.resources.filter((r) => r.id).map((r) => ({
                id: r.id!,
                file_name: r.file_name,
                file_type: "pdf",
                concepts_count: r.concepts_count,
            })));

            // Pre-generate content for first 2 topics
            const firstTopics = res.data.syllabus.units
                .flatMap((u) => u.topics)
                .slice(0, 2);
            firstTopics.forEach((t, i) => {
                setTimeout(() => {
                    scrollApi.pregenContent(t.name, t.concepts, res.data.subject).catch(() => {});
                }, i * 3000);
            });
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Failed to process document");
        } finally {
            setIsPdfUploading(false);
        }
    }, [store, auth.user?.id]);

    // ----- CODEBASE ANALYZE (home screen) -----
    const handleCodebaseAnalyze = useCallback(async () => {
        const url = store.githubUrlInput.trim();
        if (!url) return;
        store.setCodebaseLoading(true);
        store.setError(null);
        try {
            const res = await codebaseApi.analyze(url, auth.user?.id);
            if (res.success) {
                store.setCodebaseAnalysis(res.data.analysis);
                if (res.data.syllabus) {
                    store.setSyllabus(res.data.syllabus);
                }
                store.setSelectedSubject(res.data.syllabus_subject);
            } else {
                store.setError(res.error ?? "Failed to analyze repository");
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Failed to analyze repository");
        } finally {
            store.setCodebaseLoading(false);
        }
    }, [store, auth.user?.id]);

    // ----- RESOURCE UPLOAD (SkillTreePath) -----
    const handleUploadResource = useCallback(async (files: FileList) => {
        if (!store.selectedSubject) return;
        store.setIsUploadingResource(true);
        try {
            const formData = new FormData();
            formData.append("subject", store.selectedSubject);
            if (auth.user?.id) formData.append("student_id", auth.user.id);
            for (const file of Array.from(files)) {
                formData.append("files", file);
            }
            const res = await resourcesApi.upload(formData);
            if (res.success) {
                // Add to store
                for (const r of res.data.resources) {
                    if (r.id) {
                        store.addSubjectResource({
                            id: r.id,
                            file_name: r.file_name,
                            file_type: "pdf",
                            concepts_count: r.concepts_count,
                        });
                    }
                }
                // Auto-regenerate the skill tree with new materials
                setIsRegenerating(true);
                try {
                    const regenRes = await resourcesApi.regenerateSyllabus(store.selectedSubject!, auth.user?.id);
                    if (regenRes.success) {
                        store.setSyllabus(regenRes.data);
                        store.setSelectedSubject(regenRes.data.subject);
                    }
                } catch {
                    // Silently handle — tree still works without regen
                } finally {
                    setIsRegenerating(false);
                }
            } else {
                store.setError(res.error ?? "Upload failed");
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            store.setIsUploadingResource(false);
        }
    }, [store, auth.user?.id]);

    const handleDeleteResource = useCallback(async (resourceId: string) => {
        const res = await resourcesApi.delete(resourceId);
        if (res.success) {
            store.removeSubjectResource(resourceId);
        }
    }, [store]);

    const handleRegenerateSyllabus = useCallback(async () => {
        if (!store.selectedSubject) return;
        setIsRegenerating(true);
        setShowRegenBanner(false);
        try {
            const res = await resourcesApi.regenerateSyllabus(store.selectedSubject, auth.user?.id);
            if (res.success) {
                store.setSyllabus(res.data);
                store.setSelectedSubject(res.data.subject);
            } else {
                store.setError(res.error ?? "Regeneration failed");
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Regeneration failed");
        } finally {
            setIsRegenerating(false);
        }
    }, [store, auth.user?.id]);

    // ----- START FEED -----
    const handleStart = useCallback(async () => {
        if (!store.topicInput.trim()) return;
        store.setIsLoading(true);
        store.setError(null);

        try {
            const studentName = getStudentName(auth.user);
            // Build preferences for API
            const prefs = store.preferences;
            const apiPrefs = {
                difficulty: prefs.difficulty,
                content_mix: prefs.contentMix,
                question_style: prefs.questionStyle,
            };

            const res = await scrollApi.startFeed(
                store.topicInput.trim(),
                studentName,
                auth.user?.id,
                store.notesInput.trim() || undefined,
                apiPrefs,
            );

            if (!res.success) {
                store.setError(res.error ?? "Failed to start feed");
                store.setIsLoading(false);
                return;
            }

            store.setSessionId(res.data.session_id);
            store.setTopic(store.topicInput.trim());
            store.setCards(res.data.cards);
            store.setCurrentIdx(0);
            store.setStats(res.data.stats);
            store.clearCardState();
            answerStartTime.current = Date.now();
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            store.setIsLoading(false);
        }
    }, [store, auth.user]);

    // ----- SUBMIT ANSWER -----
    const answeredCardIdx = useRef<number>(-1);
    const handleAnswer = useCallback(
        async (answer: string, confidence?: number) => {
            if (!store.sessionId || store.result) return;

            const timeMs = Date.now() - answerStartTime.current;
            const currentCard = store.cards[store.currentIdx];
            if (!currentCard) return;

            answeredCardIdx.current = store.currentIdx;

            const isCorrect = answer.trim().toUpperCase() === currentCard.correct_answer.trim().toUpperCase();
            store.setResult({
                isCorrect,
                xpEarned: isCorrect ? currentCard.xp_value : 0,
                streakBroken: !isCorrect && store.stats.streak >= 3,
            });

            try {
                const res = await scrollApi.submitAnswer(store.sessionId, answer, timeMs, currentCard.content_item_id, currentCard.correct_answer, confidence, { prompt: currentCard.prompt, options: currentCard.options, explanation: currentCard.explanation, concept: currentCard.concept });
                if (res.success) {
                    store.setStats(res.data.stats);
                    if (res.data.next_cards.length > 0) {
                        store.addCards(res.data.next_cards);
                    }
                    // Use live store state — the closure's store.currentIdx is stale if user already advanced
                    const liveIdx = useScrollSessionStore.getState().currentIdx;
                    if (answeredCardIdx.current === liveIdx) {
                        store.setAnalytics(res.data.analytics);
                        // Use server XP/streak but keep local isCorrect (already accurate)
                        store.setResult({
                            isCorrect,
                            xpEarned: res.data.xp_earned,
                            streakBroken: res.data.streak_broken,
                        });
                    }
                }
            } catch {
                // Keep local feedback if server fails
            }
        },
        [store],
    );

    // ----- NEXT CARD -----
    const handleNext = useCallback(() => {
        store.advanceCard();
        answerStartTime.current = Date.now();
    }, [store]);

    // ----- SKIP CARD -----
    const handleSkip = useCallback(async () => {
        const currentCard = store.cards[store.currentIdx];
        if (!store.sessionId || !currentCard?.content_item_id) {
            handleNext();
            return;
        }
        try {
            const res = await scrollApi.skipCard(store.sessionId, currentCard.content_item_id, "skipped");
            if (res.success) {
                store.setStats(res.data.stats);
                if (res.data.cards.length > 0) {
                    store.addCards(res.data.cards);
                }
            }
        } catch {
            // Skip anyway
        }
        handleNext();
    }, [store, handleNext]);

    // ----- FLASHCARD RATE -----
    const handleFlashcardRate = useCallback(async (rating: number) => {
        const currentCard = store.cards[store.currentIdx];
        if (!store.sessionId || !currentCard?.content_item_id) return;

        const timeMs = Date.now() - answerStartTime.current;
        try {
            const res = await scrollApi.flipFlashcard(store.sessionId, currentCard.content_item_id, timeMs, rating);
            if (res.success) {
                store.setFlashcardXp(res.data.xp_earned);
                store.setStats(res.data.stats);
            }
        } catch {
            store.setFlashcardXp(5);
        }
    }, [store]);

    // ----- INFO CARD GOT IT -----
    const handleInfoGotIt = useCallback(async () => {
        const currentCard = store.cards[store.currentIdx];
        if (!store.sessionId || !currentCard?.content_item_id) {
            store.setInfoAcknowledged(true);
            return;
        }

        const timeMs = Date.now() - answerStartTime.current;
        try {
            const res = await scrollApi.flipFlashcard(store.sessionId, currentCard.content_item_id, timeMs, 3);
            if (res.success) {
                store.setStats(res.data.stats);
            }
        } catch {
            // Continue anyway
        }
        store.setInfoAcknowledged(true);
    }, [store]);

    // ----- ANALYTICS -----
    const handleShowAnalytics = useCallback(async () => {
        if (!store.sessionId) return;
        const res = await scrollApi.getAnalytics(store.sessionId);
        if (res.success) {
            setSessionAnalytics(res.data);
            setShowAnalytics(true);
        }
    }, [store.sessionId]);

    // Keyboard
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            // Skip keyboard shortcuts when inside modals/overlays/inputs
            const tag = (e.target as HTMLElement)?.tagName;
            const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

            if ((store.result || store.flashcardXp !== null || store.infoAcknowledged) && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
                e.preventDefault();
                handleNext();
            }
            if (e.key === "Escape") {
                handleSkip();
            }
            // Arrow key navigation for feed (only when not in an input and no modal open)
            if (!inInput && !store.showHelp) {
                if (e.key === "ArrowDown" && !(store.result || store.flashcardXp !== null || store.infoAcknowledged)) {
                    // ArrowDown to skip to next card (when card is not yet answered)
                    e.preventDefault();
                    handleSkip();
                }
                if (e.key === "ArrowUp" && store.currentIdx > 0) {
                    e.preventDefault();
                    store.setCurrentIdx(store.currentIdx - 1);
                    store.clearCardState();
                }
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [store, store.result, store.flashcardXp, store.infoAcknowledged, store.showHelp, store.currentIdx, handleNext, handleSkip]);

    // ----- Quick-start: tap a topic and go -----
    const feedStartingRef = useRef(false);
    const handleQuickStart = useCallback(async (topic: string) => {
        // Guard against double-tap while already loading
        if (feedStartingRef.current || store.isLoading) return;
        feedStartingRef.current = true;
        store.setTopicInput(topic);
        store.setIsLoading(true);
        store.setError(null);
        setLoadingMessage("Resuming...");

        // Progressive loading messages
        const timeout5s = setTimeout(() => {
            if (feedStartingRef.current) setLoadingMessage("Generating questions...");
        }, 5000);

        const timeout15s = setTimeout(() => {
            if (feedStartingRef.current) setLoadingMessage("Almost ready...");
        }, 15000);

        const timeout30s = setTimeout(() => {
            if (feedStartingRef.current) setLoadingMessage("This is taking longer than usual...");
        }, 30000);

        // Final timeout to prevent infinite stuck state
        const timeout = setTimeout(() => {
            if (feedStartingRef.current) {
                feedStartingRef.current = false;
                store.setIsLoading(false);
                store.setError("Feed took too long to start. Tap to try again.");
                setLoadingMessage("Setting up your feed...");
            }
        }, 60000);

        try {
            const studentName = getStudentName(auth.user);

            // Try resuming an existing session first
            const resumeRes = await scrollApi.resumeFeed(topic, studentName);
            if (resumeRes.success) {
                store.setSessionId(resumeRes.data.session_id);
                store.setTopic(topic);
                store.setCards(resumeRes.data.cards);
                store.setCurrentIdx(0);
                store.setStats(resumeRes.data.stats);
                store.clearCardState();
                answerStartTime.current = Date.now();
                return;
            }

            // No resumable session — start fresh
            setLoadingMessage("Setting up your feed...");
            const prefs = store.preferences;
            const apiPrefs = {
                difficulty: prefs.difficulty,
                content_mix: prefs.contentMix,
                question_style: prefs.questionStyle,
            };
            // Include subject context so LLM generates domain-appropriate questions
            const topicWithContext = store.selectedSubject && !topic.includes(store.selectedSubject)
                ? `${store.selectedSubject}: ${topic}`
                : topic;
            const res = await scrollApi.startFeed(
                topicWithContext, studentName, auth.user?.id,
                store.notesInput.trim() || undefined, apiPrefs,
            );
            if (!res.success) { store.setError(res.error ?? "Failed to start feed"); return; }
            store.setSessionId(res.data.session_id);
            store.setTopic(topic);
            store.setCards(res.data.cards);
            store.setCurrentIdx(0);
            store.setStats(res.data.stats);
            store.clearCardState();
            answerStartTime.current = Date.now();
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            clearTimeout(timeout5s);
            clearTimeout(timeout15s);
            clearTimeout(timeout30s);
            clearTimeout(timeout);
            feedStartingRef.current = false;
            store.setIsLoading(false);
            setLoadingMessage("Setting up your feed...");
        }
    }, [store, auth.user]);

    // ----- SUBJECT SELECTION (uses prefetch cache when available) -----
    const handleSubjectSelect = useCallback(async (subject: string) => {
        store.setSelectedSubject(subject);
        store.setError(null);

        // Check prefetch cache first — instant transition
        const cached = prefetchCache.current.get(subject);
        if (cached) {
            store.setSyllabus(cached);
            store.setSelectedSubject(cached.subject);
            // Still pre-gen content for first 2 topics (may already be done)
            const firstTopics = cached.units
                .flatMap((u) => u.topics)
                .slice(0, 2);
            firstTopics.forEach((t, i) => {
                setTimeout(() => {
                    scrollApi.pregenContent(t.name, t.concepts, cached.subject).catch(() => {});
                }, i * 3000);
            });
            resourcesApi.list(cached.subject, auth.user?.id).then((rRes) => {
                if (rRes.success) {
                    store.setSubjectResources(rRes.data.resources.map((r) => ({
                        id: r.id,
                        file_name: r.file_name,
                        file_type: r.file_type,
                        concepts_count: r.concepts_count,
                    })));
                }
            }).catch(() => {});
            return;
        }

        // No cache — fetch live
        store.setSyllabusLoading(true);
        try {
            const res = await syllabusApi.generate(subject, auth.user?.id);
            if (res.success) {
                store.setSyllabus(res.data);
                store.setSelectedSubject(res.data.subject);
                const firstTopics = res.data.units
                    .flatMap((u) => u.topics)
                    .slice(0, 2);
                firstTopics.forEach((t, i) => {
                    setTimeout(() => {
                        scrollApi.pregenContent(t.name, t.concepts, res.data.subject).catch(() => {});
                    }, i * 3000);
                });
                resourcesApi.list(res.data.subject, auth.user?.id).then((rRes) => {
                    if (rRes.success) {
                        store.setSubjectResources(rRes.data.resources.map((r) => ({
                            id: r.id,
                            file_name: r.file_name,
                            file_type: r.file_type,
                            concepts_count: r.concepts_count,
                        })));
                    }
                }).catch(() => {});
            } else {
                store.setError(res.error ?? "Failed to generate syllabus");
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Failed to generate syllabus");
        } finally {
            store.setSyllabusLoading(false);
        }
    }, [store, auth.user?.id]);

    // ----- TOPIC NODE TAP → START FEED -----
    const handleNodeTap = useCallback(async (topic: SyllabusTopic) => {
        if (feedStartingRef.current || store.isLoading) return;
        store.setActiveSyllabusNode(topic.id);
        store.setTopicInput(topic.name);
        await handleQuickStart(topic.name);
    }, [store, handleQuickStart]);

    // ----- MASTERY FETCH + RECOMMENDED PATH -----
    const fetchMastery = useCallback(async () => {
        if (!store.syllabus) return;
        const studentName = getStudentName(auth.user);
        const res = await learnApi.getProgress(studentName);
        if (res.success) {
            const masteryMap: Record<string, number> = {};
            const conceptScores: Record<string, number> = {};
            for (const m of res.data.mastery) {
                conceptScores[m.concept.toLowerCase()] = m.score;
            }
            // Aggregate per topic
            for (const unit of store.syllabus.units) {
                for (const topic of unit.topics) {
                    const scores = topic.concepts.map(
                        (c) => conceptScores[c.toLowerCase()] ?? 0,
                    );
                    masteryMap[topic.id] =
                        scores.length > 0
                            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                            : 0;
                }
            }
            store.setMastery(masteryMap);
        }

        // Fetch recommended path from RL engine
        if (store.selectedSubject) {
            const pathRes = await syllabusApi.getRecommendedPath(store.selectedSubject, studentName);
            if (pathRes.success) {
                store.setRecommendedNext(pathRes.data.next);
            }
        }
    }, [store, store.syllabus, store.selectedSubject, auth.user?.name]);

    // ----- PRESENCE POLLING -----
    useEffect(() => {
        if (!store.selectedSubject || !store.syllabus || store.sessionId) return;
        const poll = async () => {
            const res = await syllabusApi.getPresence(store.selectedSubject!);
            if (res.success) {
                const counts: Record<string, number> = {};
                for (const [nodeId, data] of Object.entries(res.data)) {
                    counts[nodeId] = data.count;
                }
                store.setPresence(counts);
            }
        };
        poll();
        const interval = setInterval(poll, 30000);
        return () => clearInterval(interval);
    }, [store.selectedSubject, store.syllabus, store.sessionId, store]);

    // ----- HEARTBEAT WHILE IN FEED -----
    useEffect(() => {
        if (!store.sessionId || !store.selectedSubject || !store.activeSyllabusNode) return;
        const studentName = getStudentName(auth.user);
        const beat = () => {
            syllabusApi.heartbeat(store.selectedSubject!, store.activeSyllabusNode!, studentName);
        };
        beat();
        const interval = setInterval(beat, 30000);
        return () => clearInterval(interval);
    }, [store.sessionId, store.selectedSubject, store.activeSyllabusNode, auth.user?.name]);

    // Fetch mastery when returning to tree
    useEffect(() => {
        if (!store.sessionId && store.syllabus) {
            fetchMastery();
        }
    }, [store.sessionId, store.syllabus, fetchMastery]);

    // Fetch learning history on mount (for personalized home)
    useEffect(() => {
        if (store.sessionId || store.syllabus) return; // Only on home screen
        const studentName = getStudentName(auth.user);
        store.setHistoryLoading(true);
        learnApi.getHistory(studentName).then((res) => {
            if (res.success) {
                store.setHistory(res.data.subjects, res.data.overall);
                store.setSuggestions(res.data.suggestions ?? []);
                store.setActiveSession(res.data.active_session ?? null);
            }
        }).finally(() => store.setHistoryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store.sessionId, store.syllabus]);

    // ----- PREFETCH SYLLABI for recommended subjects -----
    const prefetchCache = useRef<Map<string, SyllabusTree>>(new Map());
    const [prefetchedSubjects, setPrefetchedSubjects] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (store.sessionId || store.syllabus) return;
        // Prefetch suggestions + first 2 history subjects
        const toPrefetch = [
            ...store.suggestions.slice(0, 3),
            ...store.history.slice(0, 2).map((h) => h.subject),
        ];
        if (toPrefetch.length === 0) return;

        const studentId = auth.user?.id;
        toPrefetch.forEach((subject, i) => {
            if (prefetchCache.current.has(subject)) return;
            // Stagger requests to avoid hammering the API
            setTimeout(() => {
                syllabusApi.generate(subject, studentId).then((res) => {
                    if (res.success) {
                        prefetchCache.current.set(subject, res.data);
                        setPrefetchedSubjects((prev) => new Set(prev).add(subject));
                        // Also pre-generate content for the first topic
                        const firstTopic = res.data.units
                            .flatMap((u) => u.topics)[0];
                        if (firstTopic) {
                            scrollApi.pregenContent(firstTopic.name, firstTopic.concepts, res.data.subject).catch(() => {});
                        }
                    }
                }).catch(() => {});
            }, i * 2000);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store.suggestions.length, store.history.length, store.sessionId, store.syllabus]);

    // ----- IDLE STATE -----
    if (!store.sessionId) {

        // ---------- PHASE 2: Skill Tree (Duolingo winding path) ----------
        if (store.syllabus && store.selectedSubject) {
            const totalPresence = Object.values(store.presence).reduce((a, b) => a + b, 0);

            return (
                <>
                    <SkillTreePath
                        syllabus={store.syllabus}
                        mastery={store.mastery}
                        presence={store.presence}
                        recommendedNext={store.recommendedNext}
                        totalPresence={totalPresence}
                        resourceCount={store.subjectResources.length}
                        isUploading={store.isUploadingResource}
                        onNodeTap={handleNodeTap}
                        onBack={() => store.clearSyllabus()}
                        onUploadResource={handleUploadResource}
                        onManageResources={() => setShowResourceSheet(true)}
                        onOpenAnalysis={() => setShowAnalysis(true)}
                    />

                    {/* Analysis bottom sheet */}
                    <SkillTreeAnalysis
                        open={showAnalysis}
                        onClose={() => setShowAnalysis(false)}
                        subject={store.selectedSubject}
                        studentName={getStudentName(auth.user)}
                        onStudyNow={(concept) => {
                            setShowAnalysis(false);
                            // Find the matching topic from the syllabus
                            const topic = store.syllabus!.units
                                .flatMap((u) => u.topics)
                                .find((t) => t.name === concept || t.concepts.some((c) => c.toLowerCase() === concept.toLowerCase()));
                            if (topic) {
                                handleNodeTap(topic);
                            } else {
                                // Fallback: start a session with the concept name directly
                                store.setTopicInput(concept);
                                handleQuickStart(concept);
                            }
                        }}
                    />

                    {/* Auto-regeneration progress banner */}
                    {isRegenerating && (
                        <div className="fixed bottom-20 left-4 right-4 z-50">
                            <div className="px-4 py-3 rounded-2xl bg-violet-500/10 border border-violet-500/25 backdrop-blur-sm flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin shrink-0" role="status" aria-label="Adapting tree" />
                                <span className="text-sm text-violet-300">
                                    Adapting tree to your materials...
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Resource management bottom sheet */}
                    <BottomSheet open={showResourceSheet} onClose={() => setShowResourceSheet(false)} title="Uploaded Materials">
                        <div className="space-y-2">
                            {store.subjectResources.length === 0 && (
                                <p className="text-sm text-gray-500 py-4 text-center">
                                    No materials uploaded yet. Tap the upload icon to add PDFs or notes.
                                </p>
                            )}
                            {store.subjectResources.map((r) => (
                                <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-800/40">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm text-gray-200 truncate">{r.file_name}</div>
                                        <div className="text-[11px] text-gray-500 mt-0.5">{r.concepts_count} concepts</div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteResource(r.id)}
                                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 ml-3"
                                        aria-label={`Delete ${r.file_name}`}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </BottomSheet>

                    {/* Error overlay */}
                    {store.error && (
                        <div className="fixed bottom-20 left-4 right-4 z-50 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm backdrop-blur-sm">
                            {typeof store.error === "string" ? store.error : "Something went wrong"}
                        </div>
                    )}

                    {/* Loading overlay */}
                    {store.isLoading && (
                        <div className="fixed bottom-20 left-0 right-0 z-50 flex items-center justify-center gap-2 pb-4" role="status" aria-label="Loading">
                            <div className="px-4 py-2 rounded-full bg-gray-900/90 border border-gray-800/60 backdrop-blur-sm flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                                <span className="text-sm text-gray-400">{loadingMessage}</span>
                            </div>
                        </div>
                    )}
                </>
            );
        }

        // ---------- Personalized Home ----------
        const hasHistory = store.history.length > 0;
        // Time-relative label
        const timeAgo = (iso: string | null) => {
            if (!iso) return "";
            // Append Z if no timezone marker — SQLite strips timezone from UTC datetimes
            const normalized = /[Z+\-]\d{0,2}:?\d{0,2}$/.test(iso) ? iso : iso + "Z";
            const diff = Date.now() - new Date(normalized).getTime();
            if (diff < 0 || diff < 60000) return "just now";
            const mins = Math.floor(diff / 60000);
            if (mins < 60) return `${mins}m ago`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `${hours}h ago`;
            const days = Math.floor(hours / 24);
            if (days < 7) return `${days}d ago`;
            return `${Math.floor(days / 7)}w ago`;
        };

        // Filter explore subjects to exclude already-studied ones
        return (
            <div className="h-full flex flex-col overflow-y-auto" style={{
                background: "linear-gradient(180deg, #08070f 0%, #0d0b1a 40%, #0a0918 100%)",
            }}>
                <div className="flex-1 flex flex-col px-5 pt-10 pb-8">
                    {/* Header + stats bar */}
                    <div className="mb-6">
                        <h1 className="text-[26px] font-black text-white tracking-tight leading-tight">
                            {hasHistory ? "Welcome back" : "What do you want\nto learn?"}
                        </h1>
                        {hasHistory && store.historyOverall && (
                            <div className="flex items-center gap-4 mt-3">
                                <div className="flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-[13px] font-bold text-amber-400 tabular-nums">{store.historyOverall.total_xp}</span>
                                    <span className="text-[11px] text-gray-600">XP</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5 text-violet-400" />
                                    <span className="text-[13px] font-bold text-gray-300 tabular-nums">{store.historyOverall.total_questions}</span>
                                    <span className="text-[11px] text-gray-600">answered</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[13px] font-bold text-gray-300 tabular-nums">{store.historyOverall.concepts_mastered}</span>
                                    <span className="text-[11px] text-gray-600">mastered</span>
                                </div>
                            </div>
                        )}
                        {!hasHistory && (
                            <p className="text-gray-500 text-[14px] mt-2">
                                Pick a subject or search for anything.
                            </p>
                        )}
                    </div>

                    {/* Search bar */}
                    <div className="relative mb-6">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                        <input
                            type="text"
                            value={store.topicInput}
                            onChange={(e) => store.setTopicInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && store.topicInput.trim()) handleSubjectSelect(store.topicInput.trim());
                            }}
                            placeholder="Search any subject..."
                            className="w-full pl-10 pr-4 py-3 rounded-2xl text-gray-100 placeholder-gray-600 focus:outline-none text-sm transition-all"
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.06)",
                            }}
                        />
                        {store.topicInput.trim() && (
                            <button
                                onClick={() => handleSubjectSelect(store.topicInput.trim())}
                                disabled={store.syllabusLoading}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-500 disabled:opacity-50 transition-all active:scale-95"
                            >
                                {store.syllabusLoading ? "..." : "Go"}
                            </button>
                        )}
                    </div>

                    {/* ---- PDF Upload ---- */}
                    <div className="mb-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.txt,.md"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    handlePdfToSyllabus(e.target.files);
                                    e.target.value = "";
                                }
                            }}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isPdfUploading}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
                            style={{
                                background: "rgba(139,92,246,0.06)",
                                border: "1px solid rgba(139,92,246,0.15)",
                            }}
                        >
                            {isPdfUploading ? (
                                <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0" role="status" aria-label="Uploading" />
                            ) : (
                                <Upload className="w-4 h-4 text-violet-400 shrink-0" />
                            )}
                            <span className="text-gray-300">
                                {isPdfUploading ? "Processing..." : "Upload PDF or notes"}
                            </span>
                        </button>
                    </div>

                    {/* ---- GitHub URL Input ---- */}
                    <div className="relative mb-6">
                        <Github className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                        <input
                            type="text"
                            value={store.githubUrlInput}
                            onChange={(e) => store.setGithubUrlInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && store.githubUrlInput.trim()) handleCodebaseAnalyze();
                            }}
                            placeholder="Paste GitHub URL to learn a project..."
                            className="w-full pl-10 pr-4 py-3 rounded-2xl text-gray-100 placeholder-gray-600 focus:outline-none text-sm transition-all"
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.06)",
                            }}
                        />
                        {store.githubUrlInput.trim() && (
                            <button
                                onClick={handleCodebaseAnalyze}
                                disabled={store.codebaseLoading}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-500 disabled:opacity-50 transition-all active:scale-95"
                            >
                                {store.codebaseLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" role="status" aria-label="Analyzing" /> : "Analyze"}
                            </button>
                        )}
                    </div>

                    {/* ---- 1. Resume Banner ---- */}
                    {store.activeSession && (
                        <div className="mb-6">
                            <button
                                onClick={() => handleQuickStart(store.activeSession!.topic)}
                                disabled={store.isLoading || store.syllabusLoading}
                                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left active:scale-[0.98] transition-all disabled:opacity-60 group"
                                style={{
                                    background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.08) 100%)",
                                    border: "1px solid rgba(139,92,246,0.25)",
                                }}
                            >
                                {/* Progress ring */}
                                <div className="relative w-12 h-12 shrink-0">
                                    <svg viewBox="0 0 48 48" className="w-12 h-12">
                                        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="3" />
                                        <circle
                                            cx="24" cy="24" r="20" fill="none"
                                            stroke="#8b5cf6"
                                            strokeWidth="3" strokeLinecap="round"
                                            strokeDasharray={`${2 * Math.PI * 20}`}
                                            strokeDashoffset={`${2 * Math.PI * 20 * (1 - store.activeSession.accuracy / 100)}`}
                                            transform="rotate(-90 24 24)"
                                            style={{ filter: "drop-shadow(0 0 6px rgba(139,92,246,0.5))" }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Play className="w-4 h-4 text-violet-400 ml-0.5" />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-bold text-violet-300 truncate group-hover:text-violet-200 transition-colors">
                                        Continue: {store.activeSession.topic}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[11px] text-gray-400 tabular-nums">
                                            {store.activeSession.questions_answered} Qs
                                        </span>
                                        <span className="text-[11px] text-gray-400 tabular-nums">
                                            {store.activeSession.accuracy}%
                                        </span>
                                        {store.activeSession.total_xp > 0 && (
                                            <span className="text-[11px] text-amber-400/70 font-semibold tabular-nums">
                                                {store.activeSession.total_xp} XP
                                            </span>
                                        )}
                                        {store.activeSession.streak > 0 && (
                                            <span className="flex items-center gap-0.5 text-[11px] text-orange-400/70 font-semibold">
                                                <Flame className="w-3 h-3" />
                                                {store.activeSession.streak}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <ArrowRight className="w-5 h-5 text-violet-400/60 group-hover:text-violet-300 transition-colors shrink-0" />
                            </button>
                        </div>
                    )}

                    {/* ---- 2. Your Subjects ---- */}
                    {hasHistory && (
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">Your Subjects</h2>
                            </div>
                            <div className="space-y-2.5">
                                {store.history.slice(0, 6).map((subj) => (
                                    <button
                                        key={subj.subject}
                                        onClick={() => handleSubjectSelect(subj.subject)}
                                        disabled={store.syllabusLoading}
                                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left active:scale-[0.98] transition-all disabled:opacity-40 group"
                                        style={{
                                            background: "rgba(255,255,255,0.02)",
                                            border: "1px solid rgba(255,255,255,0.05)",
                                        }}
                                    >
                                        {/* Progress circle */}
                                        <div className="relative w-11 h-11 shrink-0">
                                            <svg viewBox="0 0 44 44" className="w-11 h-11">
                                                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                                                <circle
                                                    cx="22" cy="22" r="18" fill="none"
                                                    stroke={subj.accuracy >= 80 ? "#34d399" : "#8b5cf6"}
                                                    strokeWidth="3" strokeLinecap="round"
                                                    strokeDasharray={`${2 * Math.PI * 18}`}
                                                    strokeDashoffset={`${2 * Math.PI * 18 * (1 - subj.accuracy / 100)}`}
                                                    transform="rotate(-90 22 22)"
                                                    style={{ filter: `drop-shadow(0 0 4px ${subj.accuracy >= 80 ? "rgba(52,211,153,0.4)" : "rgba(139,92,246,0.3)"})` }}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-[11px] font-black text-white/70 tabular-nums">{subj.accuracy}%</span>
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[14px] font-bold text-gray-200 truncate group-hover:text-white transition-colors">{subj.subject}</div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[11px] text-gray-500">
                                                    {subj.total_questions} {subj.total_questions === 1 ? "question" : "questions"}
                                                </span>
                                                {subj.total_xp > 0 && (
                                                    <span className="text-[11px] text-amber-500/70 font-semibold">{subj.total_xp} XP</span>
                                                )}
                                                <span className="text-[10px] text-gray-600">{timeAgo(subj.last_studied_at)}</span>
                                            </div>
                                        </div>

                                        {/* Arrow */}
                                        <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 transition-colors shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ---- 3. Recommended ---- */}
                    {store.suggestions.length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-violet-400" />
                                Recommended
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {store.suggestions.map((s) => {
                                    const isReady = prefetchedSubjects.has(s);
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => handleSubjectSelect(s)}
                                            disabled={store.syllabusLoading}
                                            className={cn(
                                                "px-3.5 py-2 rounded-xl text-[13px] font-semibold active:scale-[0.97] transition-all disabled:opacity-40 flex items-center gap-1.5",
                                                isReady ? "text-gray-200 hover:text-white" : "text-gray-400 hover:text-gray-300",
                                            )}
                                            style={{
                                                background: isReady ? "rgba(139,92,246,0.10)" : "rgba(139,92,246,0.04)",
                                                border: isReady ? "1px solid rgba(139,92,246,0.25)" : "1px solid rgba(139,92,246,0.10)",
                                            }}
                                        >
                                            {s}
                                            {isReady && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}


                    {/* Error */}
                    {store.error && (
                        <div className="mt-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {typeof store.error === "string" ? store.error : "Something went wrong"}
                        </div>
                    )}

                    {/* Loading indicator */}
                    {store.syllabusLoading && (
                        <div className="mt-6 flex items-center justify-center gap-2" role="status" aria-label="Loading">
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                            <span className="text-sm text-gray-500">Generating skill tree...</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ----- ACTIVE FEED -----
    const currentCard = store.cards[store.currentIdx];

    if (!currentCard) {
        return (
            <div className="h-full bg-gray-950 flex items-center justify-center" role="status" aria-label="Loading">
                <div className="text-center space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto animate-pulse">
                        <Zap className="w-5 h-5 text-violet-400" />
                    </div>
                    <p className="text-gray-500 text-sm">Loading next cards...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-gray-950 flex flex-col overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/40 bg-gray-950 shrink-0 z-10">
                {store.selectedSubject ? (
                    <button
                        onClick={() => { store.reset(); }}
                        className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors"
                        aria-label={`Back to ${store.selectedSubject}`}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-xs font-medium max-w-[80px] truncate">{store.selectedSubject}</span>
                    </button>
                ) : (
                    <div className="w-8" /> /* Spacer for symmetry */
                )}

                {/* Stats pills */}
                <div className="flex items-center gap-2">
                    {store.stats.streak > 0 && (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/15">
                            <Flame className="w-3.5 h-3.5 text-orange-400" />
                            <span className="text-xs font-bold text-orange-400">{store.stats.streak}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/15">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-amber-400">{store.stats.total_xp}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowTuneSheet(true)}
                        className="p-2 rounded-xl hover:bg-gray-900 text-gray-500 transition-colors"
                        aria-label="Feed settings"
                    >
                        <Settings2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleShowAnalytics}
                        className="p-2 -mr-1 rounded-xl hover:bg-gray-900 text-gray-500 transition-colors"
                        aria-label="Session analytics"
                    >
                        <BarChart3 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Card area */}
            <div className="flex-1 overflow-hidden relative" aria-live="polite">
                {!store.result && store.flashcardXp === null && !store.infoAcknowledged && (
                    <button
                        onClick={handleSkip}
                        className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-gray-900/80 border border-gray-800/60 text-gray-600 hover:text-gray-400 hover:border-gray-700 transition-colors"
                        title="Skip card"
                        aria-label="Skip card"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}

                {currentCard.card_type === "flashcard" ? (
                    <FlashcardCard
                        card={currentCard}
                        onRate={handleFlashcardRate}
                        onNext={handleNext}
                        stats={store.stats}
                        xpEarned={store.flashcardXp}
                    />
                ) : currentCard.card_type === "info_card" ? (
                    <InfoCardComponent
                        card={currentCard}
                        onGotIt={handleInfoGotIt}
                        onNext={handleNext}
                        xpAwarded={store.infoAcknowledged}
                    />
                ) : (
                    <QuizCard
                        card={currentCard}
                        onAnswer={handleAnswer}
                        onNext={handleNext}
                        onHelp={() => store.setShowHelp(true)}
                        result={store.result}
                        stats={store.stats}
                        analytics={store.analytics}
                    />
                )}
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-center px-4 py-2 border-t border-gray-800/40 bg-gray-950 shrink-0">
                <span className="text-[11px] text-gray-600">
                    Card {store.currentIdx + 1}
                    <span className="text-gray-700 mx-1.5">/</span>
                    {store.cards.length}+
                    <span className="text-gray-700 mx-2">&#183;</span>
                    Level {Math.round((store.stats.difficulty || 0.4) * 100)}%
                </span>
            </div>

            {/* Socratic help overlay */}
            {store.showHelp && store.sessionId && currentCard && (
                <SocraticOverlay card={currentCard} sessionId={store.sessionId} onClose={() => store.setShowHelp(false)} />
            )}

            {/* Analytics overlay */}
            {showAnalytics && sessionAnalytics && (
                <AnalyticsOverlay data={sessionAnalytics} onClose={() => setShowAnalytics(false)} />
            )}

            {/* Feed tune bottom sheet */}
            <BottomSheet open={showTuneSheet} onClose={() => setShowTuneSheet(false)} title="Feed Settings">
                <div className="space-y-5">
                    <FeedTuneControls mode="active" />

                    {/* Divider */}
                    <div className="h-px bg-gray-800" />

                    {/* Upload materials */}
                    <div className="space-y-2">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Study Materials</span>
                        <label className={cn(
                            "flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-colors",
                            isProcessingFile ? "border-violet-500/40 bg-violet-500/5"
                                : uploadedFile ? "border-emerald-500/30 bg-emerald-500/5"
                                    : "border-gray-800 hover:border-gray-700",
                        )}>
                            <Upload className={cn(
                                "w-4 h-4 shrink-0",
                                isProcessingFile ? "text-violet-400 animate-pulse" : uploadedFile ? "text-emerald-400" : "text-gray-500",
                            )} />
                            <span className={cn(
                                "text-sm truncate",
                                isProcessingFile ? "text-violet-300" : uploadedFile ? "text-emerald-300" : "text-gray-400",
                            )}>
                                {isProcessingFile ? "Processing..." : uploadedFile ? uploadedFile.name : "Upload PDF or notes"}
                            </span>
                            <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                        </label>

                        <button
                            onClick={() => setShowNotes(!showNotes)}
                            className="text-xs text-gray-500 hover:text-gray-400 flex items-center gap-1.5 px-1 transition-colors"
                        >
                            <BookOpen className="w-3 h-3" />
                            {showNotes ? "Hide notes" : "Add notes"}
                        </button>
                        {showNotes && (
                            <textarea
                                value={store.notesInput}
                                onChange={(e) => store.setNotesInput(e.target.value)}
                                placeholder="Paste class notes here..."
                                rows={3}
                                className="w-full px-3 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-700 text-sm resize-none"
                            />
                        )}
                    </div>

                    {/* New session */}
                    <button
                        onClick={() => { store.reset(); setShowTuneSheet(false); }}
                        className="w-full py-2.5 rounded-xl border border-gray-800 text-gray-400 text-sm hover:bg-gray-900 hover:text-gray-300 transition-all"
                    >
                        Start new topic
                    </button>
                </div>
            </BottomSheet>
        </div>
    );
}
