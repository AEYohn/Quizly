"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
    Brain, Sparkles, Users, Zap, ArrowRight,
    GraduationCap, MessageSquare, Play, Trophy, Gamepad2,
    BookOpen, Target, Bot, FileText, BarChart3, Lightbulb
} from "lucide-react";

export default function Home() {
    const { isSignedIn, isLoaded } = useAuth();
    const router = useRouter();

    // Redirect authenticated users to their dashboard
    useEffect(() => {
        if (isLoaded && isSignedIn) {
            const savedUser = localStorage.getItem("quizly_user");
            if (savedUser) {
                try {
                    const user = JSON.parse(savedUser);
                    if (user.role === "teacher") {
                        router.push("/teacher");
                        return;
                    } else if (user.role === "student") {
                        router.push("/student/dashboard");
                        return;
                    }
                } catch {}
            }
            router.push("/student/dashboard");
        }
    }, [isLoaded, isSignedIn, router]);

    // Show loading while checking auth
    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-gray-400 animate-pulse" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-950">
            {/* Nav */}
            <nav className="fixed top-0 z-50 w-full bg-gray-950/80 backdrop-blur-lg border-b border-gray-800">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                            <Sparkles className="h-5 w-5 text-gray-900" />
                        </div>
                        <span className="text-xl font-bold text-white">Quizly</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/join"
                            className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                        >
                            Join Game
                        </Link>
                        <Link
                            href="/sign-in"
                            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 transition-colors"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-32 pb-16 px-6">
                <div className="mx-auto max-w-4xl text-center">
                    <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                        Quizzes that actually
                        <span className="block text-gray-400">help you learn</span>
                    </h1>

                    <p className="text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10">
                        Live quiz games with an AI tutor. Answer questions, chat with AI when stuck,
                        and get a personalized study packet after every game.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/join"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-bold text-gray-900 hover:bg-gray-200 transition-colors"
                        >
                            <Gamepad2 className="h-5 w-5" />
                            Join a Game
                        </Link>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                        <Link
                            href="/sign-in"
                            onClick={() => localStorage.setItem("quizly_pending_role", "teacher")}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-800 border border-gray-700 px-6 py-3 text-base font-medium text-white hover:bg-gray-700 transition-colors"
                        >
                            <GraduationCap className="h-5 w-5" />
                            I&apos;m a Teacher
                        </Link>
                        <Link
                            href="/sign-in"
                            onClick={() => localStorage.setItem("quizly_pending_role", "student")}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-800 border border-gray-700 px-6 py-3 text-base font-medium text-white hover:bg-gray-700 transition-colors"
                        >
                            <Users className="h-5 w-5" />
                            I&apos;m a Student
                        </Link>
                    </div>
                </div>
            </section>

            {/* How It Works - Simple */}
            <section className="py-16 px-6">
                <div className="mx-auto max-w-5xl">
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900 border border-gray-800 mb-4">
                                <Play className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Join & Play</h3>
                            <p className="text-gray-500 text-sm">
                                Enter a game code and answer questions in real-time with your class
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900 border border-gray-800 mb-4">
                                <Bot className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">AI Helps You Learn</h3>
                            <p className="text-gray-500 text-sm">
                                Got it wrong? Chat with AI to understand why before moving on
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900 border border-gray-800 mb-4">
                                <FileText className="h-7 w-7 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Get Study Notes</h3>
                            <p className="text-gray-500 text-sm">
                                After each game, get a personalized study packet with practice problems
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Feature Showcase */}
            <section className="py-16 px-6">
                <div className="mx-auto max-w-5xl space-y-12">
                    {/* Feature 1: AI Tutor */}
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 text-sm text-gray-500 mb-3">
                                <MessageSquare className="h-4 w-4" />
                                AI Tutor
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-4">
                                Stuck? Chat with AI
                            </h2>
                            <p className="text-gray-400 mb-4">
                                When you get an answer wrong, don&apos;t just see the correct answer.
                                Have a conversation with our AI tutor who explains concepts in a way that makes sense to you.
                            </p>
                            <ul className="space-y-2 text-gray-500 text-sm">
                                <li className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-gray-600" />
                                    Explains why your answer was wrong
                                </li>
                                <li className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-gray-600" />
                                    Asks follow-up questions to check understanding
                                </li>
                                <li className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-gray-600" />
                                    Only moves on when you truly get it
                                </li>
                            </ul>
                        </div>
                        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                                        <Bot className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <div className="bg-gray-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-300">
                                        I see you picked B. That&apos;s a common choice! Can you tell me why you thought that was right?
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-end">
                                    <div className="bg-gray-700 rounded-2xl rounded-tr-none px-4 py-3 text-sm text-white">
                                        I thought mitosis was when cells split in half
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                                        <Bot className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <div className="bg-gray-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-300">
                                        Good thinking! You&apos;re on the right track. The key difference is what happens to the chromosomes...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Feature 2: Study Packets */}
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div className="order-2 md:order-1 bg-gray-900 rounded-2xl border border-gray-800 p-6">
                            <div className="text-center mb-4">
                                <h4 className="text-white font-semibold">Your Study Packet</h4>
                                <p className="text-gray-500 text-sm">Cell Division Basics</p>
                            </div>
                            <div className="space-y-3">
                                <div className="bg-gray-800 rounded-xl p-4">
                                    <p className="text-sm text-gray-400 uppercase tracking-wide mb-2">Key Concepts</p>
                                    <p className="text-gray-300 text-sm">Mitosis produces two identical cells, while meiosis produces four unique cells...</p>
                                </div>
                                <div className="bg-gray-800 rounded-xl p-4">
                                    <p className="text-sm text-gray-400 uppercase tracking-wide mb-2">Practice Problem</p>
                                    <p className="text-gray-300 text-sm">A cell has 46 chromosomes. After mitosis, how many chromosomes will each daughter cell have?</p>
                                </div>
                            </div>
                        </div>
                        <div className="order-1 md:order-2">
                            <div className="inline-flex items-center gap-2 text-sm text-gray-500 mb-3">
                                <BookOpen className="h-4 w-4" />
                                Study Packets
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-4">
                                Personalized notes after every game
                            </h2>
                            <p className="text-gray-400 mb-4">
                                Based on what you got wrong, AI creates a custom study packet with
                                key concepts, memory tips, and practice problems tailored to your gaps.
                            </p>
                            <ul className="space-y-2 text-gray-500 text-sm">
                                <li className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-gray-600" />
                                    Focuses on what you actually need
                                </li>
                                <li className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-gray-600" />
                                    Includes practice problems
                                </li>
                                <li className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-gray-600" />
                                    Save to your account for later
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* For Teachers & Students */}
            <section className="py-16 px-6 bg-gray-900/50">
                <div className="mx-auto max-w-5xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-white mb-4">
                            For Teachers & Students
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Teachers */}
                        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-12 w-12 rounded-xl bg-gray-800 flex items-center justify-center">
                                    <GraduationCap className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Teachers</h3>
                                    <p className="text-gray-500 text-sm">Create & host games</p>
                                </div>
                            </div>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <Sparkles className="h-5 w-5 text-gray-600 mt-0.5" />
                                    <div>
                                        <p className="text-white font-medium">AI Quiz Generator</p>
                                        <p className="text-gray-500 text-sm">Describe your topic, AI creates the questions</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <Users className="h-5 w-5 text-gray-600 mt-0.5" />
                                    <div>
                                        <p className="text-white font-medium">Live Game Hosting</p>
                                        <p className="text-gray-500 text-sm">See real-time responses and leaderboard</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <BarChart3 className="h-5 w-5 text-gray-600 mt-0.5" />
                                    <div>
                                        <p className="text-white font-medium">Class Analytics</p>
                                        <p className="text-gray-500 text-sm">See which concepts need more review</p>
                                    </div>
                                </li>
                            </ul>
                            <Link
                                href="/sign-in"
                                onClick={() => localStorage.setItem("quizly_pending_role", "teacher")}
                                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-gray-900 font-semibold hover:bg-gray-200 transition-colors"
                            >
                                Start as Teacher
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>

                        {/* Students */}
                        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-12 w-12 rounded-xl bg-gray-800 flex items-center justify-center">
                                    <Users className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Students</h3>
                                    <p className="text-gray-500 text-sm">Play & learn</p>
                                </div>
                            </div>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <Gamepad2 className="h-5 w-5 text-gray-600 mt-0.5" />
                                    <div>
                                        <p className="text-white font-medium">Join Live Games</p>
                                        <p className="text-gray-500 text-sm">Enter a code and compete with classmates</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <Bot className="h-5 w-5 text-gray-600 mt-0.5" />
                                    <div>
                                        <p className="text-white font-medium">AI Study Buddy</p>
                                        <p className="text-gray-500 text-sm">Get help understanding wrong answers</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <Target className="h-5 w-5 text-gray-600 mt-0.5" />
                                    <div>
                                        <p className="text-white font-medium">Track Progress</p>
                                        <p className="text-gray-500 text-sm">See your improvement over time</p>
                                    </div>
                                </li>
                            </ul>
                            <Link
                                href="/join"
                                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-800 border border-gray-700 px-6 py-3 text-white font-semibold hover:bg-gray-700 transition-colors"
                            >
                                Join a Game
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to play?
                    </h2>
                    <p className="text-gray-400 mb-8">
                        No account needed to join a game. Just enter the code and start learning.
                    </p>
                    <Link
                        href="/join"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-bold text-gray-900 hover:bg-gray-200 transition-colors"
                    >
                        <Gamepad2 className="h-5 w-5" />
                        Join a Game
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-gray-800">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-gray-600" />
                            <span className="font-bold text-white">Quizly</span>
                        </div>
                        <p className="text-sm text-gray-600">
                            Powered by Gemini AI
                        </p>
                    </div>
                </div>
            </footer>
        </main>
    );
}
