"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Brain,
    Target,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Clock,
    Calendar,
    BookOpen,
    ArrowRight,
    Loader2,
    Trophy,
    Flame,
    Star,
    BarChart3,
    RefreshCw
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LearningProfile {
    user_id: string;
    name: string;
    total_games_played: number;
    total_questions_answered: number;
    overall_accuracy: number;
    avg_confidence: number;
    calibration_status: string;
    learning_streak: number;
    concepts_mastered: string[];
    concepts_in_progress: string[];
    misconceptions: Array<{
        concept: string;
        description: string;
        occurrence_count: number;
        last_seen: string;
    }>;
    recent_games: Array<{
        game_id: string;
        quiz_title: string;
        score: number;
        rank: number;
        accuracy: number;
        played_at: string;
    }>;
    review_queue: Array<{
        concept: string;
        due_date: string;
        priority: string;
    }>;
    strengths: string[];
    weaknesses: string[];
}

export default function StudentProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<LearningProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"overview" | "misconceptions" | "review">("overview");

    useEffect(() => {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
            // For demo purposes, show mock data
            setProfile(getMockProfile());
            setLoading(false);
            return;
        }

        fetchProfile(token);
    }, []);

    const fetchProfile = async (token: string) => {
        try {
            const response = await fetch(`${API_URL}/students/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setProfile(data);
            } else {
                // Fall back to mock data for demo
                setProfile(getMockProfile());
            }
        } catch (err) {
            console.error("Failed to fetch profile:", err);
            setProfile(getMockProfile());
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-white" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-8">
                <AlertTriangle className="h-16 w-16 text-yellow-400 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
                <p className="text-white/70 mb-6">Please log in to view your learning profile.</p>
                <Link
                    href="/login"
                    className="rounded-full bg-white px-6 py-3 font-bold text-purple-600 hover:scale-105 transition-transform"
                >
                    Log In
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="text-2xl font-bold text-white">
                        Quizly
                    </Link>
                    <nav className="flex items-center gap-4">
                        <Link
                            href="/join"
                            className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity"
                        >
                            Join Game
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Profile Header */}
                <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-lg border border-white/20 mb-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-3xl">
                            {profile.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{profile.name}'s Learning Profile</h1>
                            <div className="flex items-center gap-4 mt-1">
                                {profile.learning_streak > 0 && (
                                    <span className="flex items-center gap-1 text-orange-400">
                                        <Flame className="h-4 w-4" />
                                        {profile.learning_streak} day streak
                                    </span>
                                )}
                                <span className="text-white/60">
                                    {profile.total_games_played} games played
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            icon={<Target className="h-5 w-5 text-green-400" />}
                            label="Accuracy"
                            value={`${Math.round(profile.overall_accuracy)}%`}
                        />
                        <StatCard
                            icon={<Brain className="h-5 w-5 text-blue-400" />}
                            label="Avg Confidence"
                            value={`${Math.round(profile.avg_confidence)}%`}
                        />
                        <StatCard
                            icon={<CheckCircle className="h-5 w-5 text-emerald-400" />}
                            label="Mastered"
                            value={profile.concepts_mastered.length.toString()}
                        />
                        <StatCard
                            icon={<AlertTriangle className="h-5 w-5 text-orange-400" />}
                            label="To Review"
                            value={profile.review_queue.length.toString()}
                        />
                    </div>
                </div>

                {/* Calibration Status */}
                <div className={`rounded-xl p-4 mb-6 ${
                    profile.calibration_status === "well_calibrated"
                        ? "bg-green-500/20 border border-green-500/30"
                        : profile.calibration_status === "overconfident"
                            ? "bg-orange-500/20 border border-orange-500/30"
                            : "bg-blue-500/20 border border-blue-500/30"
                }`}>
                    <div className="flex items-center gap-3">
                        <BarChart3 className={`h-6 w-6 ${
                            profile.calibration_status === "well_calibrated" ? "text-green-400" :
                            profile.calibration_status === "overconfident" ? "text-orange-400" : "text-blue-400"
                        }`} />
                        <div>
                            <p className="font-medium text-white capitalize">
                                {profile.calibration_status.replace("_", " ")}
                            </p>
                            <p className="text-white/70 text-sm">
                                {profile.calibration_status === "well_calibrated"
                                    ? "Your confidence aligns well with your actual performance!"
                                    : profile.calibration_status === "overconfident"
                                        ? "You tend to be more confident than your accuracy suggests. Take time to verify your answers."
                                        : "You know more than you think! Trust yourself more."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    <TabButton
                        active={activeTab === "overview"}
                        onClick={() => setActiveTab("overview")}
                        icon={<TrendingUp className="h-4 w-4" />}
                        label="Overview"
                    />
                    <TabButton
                        active={activeTab === "misconceptions"}
                        onClick={() => setActiveTab("misconceptions")}
                        icon={<AlertTriangle className="h-4 w-4" />}
                        label={`Misconceptions (${profile.misconceptions.length})`}
                    />
                    <TabButton
                        active={activeTab === "review"}
                        onClick={() => setActiveTab("review")}
                        icon={<RefreshCw className="h-4 w-4" />}
                        label={`Review Queue (${profile.review_queue.length})`}
                    />
                </div>

                {/* Tab Content */}
                {activeTab === "overview" && (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Strengths */}
                        <div className="bg-white/10 rounded-xl p-5 backdrop-blur border border-white/20">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                <Star className="h-5 w-5 text-yellow-400" />
                                Your Strengths
                            </h3>
                            <div className="space-y-2">
                                {profile.strengths.length > 0 ? (
                                    profile.strengths.map((strength, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-green-400">
                                            <CheckCircle className="h-4 w-4" />
                                            <span className="text-white">{strength}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-white/50">Keep playing to discover your strengths!</p>
                                )}
                            </div>
                        </div>

                        {/* Areas to Improve */}
                        <div className="bg-white/10 rounded-xl p-5 backdrop-blur border border-white/20">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                <Target className="h-5 w-5 text-blue-400" />
                                Focus Areas
                            </h3>
                            <div className="space-y-2">
                                {profile.weaknesses.length > 0 ? (
                                    profile.weaknesses.map((weakness, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-blue-400">
                                            <ArrowRight className="h-4 w-4" />
                                            <span className="text-white">{weakness}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-white/50">Great job! No weak areas identified yet.</p>
                                )}
                            </div>
                        </div>

                        {/* Recent Games */}
                        <div className="bg-white/10 rounded-xl p-5 backdrop-blur border border-white/20 md:col-span-2">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-400" />
                                Recent Games
                            </h3>
                            <div className="space-y-3">
                                {profile.recent_games.length > 0 ? (
                                    profile.recent_games.map((game, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between bg-white/5 rounded-lg p-3"
                                        >
                                            <div>
                                                <p className="font-medium text-white">{game.quiz_title}</p>
                                                <p className="text-sm text-white/50">
                                                    {new Date(game.played_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-white">#{game.rank}</p>
                                                <p className="text-sm text-green-400">{Math.round(game.accuracy)}% accuracy</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-white/50">No games played yet. Join a game to get started!</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "misconceptions" && (
                    <div className="bg-white/10 rounded-xl p-5 backdrop-blur border border-white/20">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-400" />
                            Misconceptions to Address
                        </h3>
                        {profile.misconceptions.length > 0 ? (
                            <div className="space-y-4">
                                {profile.misconceptions.map((m, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <h4 className="font-medium text-white">{m.concept}</h4>
                                            <span className="text-xs bg-orange-500/30 text-orange-200 px-2 py-1 rounded-full">
                                                Seen {m.occurrence_count}x
                                            </span>
                                        </div>
                                        <p className="text-white/70 text-sm">{m.description}</p>
                                        <p className="text-white/50 text-xs mt-2">
                                            Last seen: {new Date(m.last_seen).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                                <p className="text-white">No misconceptions detected!</p>
                                <p className="text-white/50 text-sm">Keep up the great work!</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "review" && (
                    <div className="bg-white/10 rounded-xl p-5 backdrop-blur border border-white/20">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <RefreshCw className="h-5 w-5 text-blue-400" />
                            Spaced Repetition Review Queue
                        </h3>
                        {profile.review_queue.length > 0 ? (
                            <div className="space-y-3">
                                {profile.review_queue.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between bg-white/5 rounded-lg p-4"
                                    >
                                        <div className="flex items-center gap-3">
                                            <BookOpen className={`h-5 w-5 ${
                                                item.priority === "high" ? "text-red-400" :
                                                item.priority === "medium" ? "text-yellow-400" : "text-green-400"
                                            }`} />
                                            <div>
                                                <p className="font-medium text-white">{item.concept}</p>
                                                <p className="text-sm text-white/50">
                                                    Due: {new Date(item.due_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            item.priority === "high" ? "bg-red-500/20 text-red-300" :
                                            item.priority === "medium" ? "bg-yellow-500/20 text-yellow-300" :
                                            "bg-green-500/20 text-green-300"
                                        }`}>
                                            {item.priority}
                                        </span>
                                    </div>
                                ))}
                                <button className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold hover:opacity-90 transition-opacity">
                                    Start Review Session
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                                <p className="text-white">All caught up!</p>
                                <p className="text-white/50 text-sm">No concepts due for review.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-white/5 rounded-xl p-4 text-center">
            <div className="flex justify-center mb-2">{icon}</div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-white/60 text-sm">{label}</p>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    icon,
    label
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
                active
                    ? "bg-white text-purple-600"
                    : "bg-white/10 text-white hover:bg-white/20"
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

function getMockProfile(): LearningProfile {
    return {
        user_id: "demo-user",
        name: "Demo Student",
        total_games_played: 12,
        total_questions_answered: 48,
        overall_accuracy: 75,
        avg_confidence: 68,
        calibration_status: "well_calibrated",
        learning_streak: 3,
        concepts_mastered: ["Variables", "Loops", "Functions"],
        concepts_in_progress: ["Recursion", "Data Structures"],
        misconceptions: [
            {
                concept: "Variable Scope",
                description: "Confusion between local and global variable scope in nested functions",
                occurrence_count: 3,
                last_seen: new Date().toISOString()
            },
            {
                concept: "Pass by Reference",
                description: "Belief that all variables are passed by value in Python",
                occurrence_count: 2,
                last_seen: new Date(Date.now() - 86400000).toISOString()
            }
        ],
        recent_games: [
            {
                game_id: "1",
                quiz_title: "Python Basics",
                score: 4500,
                rank: 2,
                accuracy: 80,
                played_at: new Date().toISOString()
            },
            {
                game_id: "2",
                quiz_title: "Data Types Quiz",
                score: 3200,
                rank: 5,
                accuracy: 65,
                played_at: new Date(Date.now() - 86400000).toISOString()
            },
            {
                game_id: "3",
                quiz_title: "Control Flow",
                score: 5000,
                rank: 1,
                accuracy: 90,
                played_at: new Date(Date.now() - 172800000).toISOString()
            }
        ],
        review_queue: [
            {
                concept: "Recursion",
                due_date: new Date().toISOString(),
                priority: "high"
            },
            {
                concept: "Binary Search",
                due_date: new Date(Date.now() + 86400000).toISOString(),
                priority: "medium"
            },
            {
                concept: "Hash Tables",
                due_date: new Date(Date.now() + 172800000).toISOString(),
                priority: "low"
            }
        ],
        strengths: ["Quick problem solving", "Strong fundamentals", "Good test-taking speed"],
        weaknesses: ["Complex recursion", "Edge case identification"]
    };
}
