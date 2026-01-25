"use client";

import Link from "next/link";
import {
    Brain, Sparkles, Users, Zap, ArrowRight,
    GraduationCap, Code2, MessageSquare, Play, Trophy, Gamepad2
} from "lucide-react";

export default function Home() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
            {/* Nav */}
            <nav className="fixed top-0 z-50 w-full bg-white/10 backdrop-blur-lg border-b border-white/10">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                        </div>
                        <span className="text-xl font-bold text-white">Quizly</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/join"
                            className="text-sm font-medium text-white/80 hover:text-white"
                        >
                            Join Game
                        </Link>
                        <Link
                            href="/login"
                            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-purple-600 hover:bg-white/90"
                        >
                            Teacher Login
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-32 pb-20 px-6">
                <div className="mx-auto max-w-4xl text-center">
                    {/* Hackathon Badge */}
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-4 py-2 text-sm font-medium text-white mb-8">
                        <Sparkles className="h-4 w-4" />
                        Gemini API Hackathon Project
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
                        Learning Made
                        <span className="block text-yellow-300">Fun with AI</span>
                    </h1>

                    <p className="text-xl text-white/80 leading-relaxed max-w-2xl mx-auto mb-10">
                        Quizly is a Kahoot-style quiz game with an AI game show host powered by Gemini.
                        Students play, learn, and get personalized feedback in real-time.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 text-lg font-bold text-purple-600 shadow-xl hover:scale-105 transition-transform"
                        >
                            <GraduationCap className="h-5 w-5" />
                            I'm a Teacher
                        </Link>
                        <Link
                            href="/join"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/20 backdrop-blur border-2 border-white/30 px-8 py-4 text-lg font-bold text-white hover:bg-white/30 transition-all"
                        >
                            <Gamepad2 className="h-5 w-5" />
                            Join a Game
                        </Link>
                    </div>

                    {/* Demo Video Placeholder */}
                    <div className="relative rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-1 max-w-3xl mx-auto">
                        <div className="rounded-xl bg-gray-900/80 aspect-video flex items-center justify-center">
                            <div className="text-center">
                                <div className="flex justify-center mb-4">
                                    <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center">
                                        <Play className="h-10 w-10 text-white ml-1" />
                                    </div>
                                </div>
                                <p className="text-white/60">Demo Video</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* What is Quizly */}
            <section className="py-20 px-6">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            What We Built
                        </h2>
                        <p className="text-xl text-white/70 max-w-2xl mx-auto">
                            An AI-powered classroom quiz game that makes learning engaging
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: Gamepad2,
                                title: "Kahoot-Style Games",
                                desc: "Live multiplayer quizzes where students compete in real-time. Fast-paced, fun, and educational."
                            },
                            {
                                icon: Sparkles,
                                title: "AI Game Host (Quizzy)",
                                desc: "Gemini-powered host that celebrates correct answers, explains wrong ones, and keeps the energy high."
                            },
                            {
                                icon: Brain,
                                title: "Smart Insights",
                                desc: "After each game, AI analyzes responses to identify class strengths and areas needing review."
                            },
                        ].map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <div key={feature.title} className="p-6 rounded-2xl bg-white/10 backdrop-blur border border-white/10 hover:bg-white/20 transition-all">
                                    <div className="inline-flex p-3 rounded-xl bg-white/20 mb-4">
                                        <Icon className="h-6 w-6 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                                    <p className="text-white/70">{feature.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Gemini Integration */}
            <section className="py-20 px-6 bg-white/5">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400/20 px-4 py-2 text-sm font-medium text-yellow-300 mb-4">
                            <Zap className="h-4 w-4" />
                            Powered by Gemini
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            How We Use Gemini AI
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {[
                            {
                                title: "AI Game Host Reactions",
                                desc: "Gemini generates witty, encouraging responses in real-time as students answer questions. It celebrates wins and provides supportive explanations for wrong answers.",
                                example: '"Nice one, Alex! You\'re on fire! 🔥"'
                            },
                            {
                                title: "Personalized Explanations",
                                desc: "When students get answers wrong, Gemini explains why the correct answer is right in a friendly, easy-to-understand way.",
                                example: '"The capital of France is Paris, not London. Paris is famous for the Eiffel Tower!"'
                            },
                            {
                                title: "Question Generation",
                                desc: "Teachers can have Gemini generate quiz questions on any topic, complete with plausible wrong answers and explanations.",
                                example: 'Generate 5 questions about photosynthesis for 6th graders'
                            },
                            {
                                title: "Class Performance Insights",
                                desc: "After games, Gemini analyzes response patterns to identify common misconceptions and suggest what topics need more review.",
                                example: '"40% of students confused mitosis with meiosis. Consider reviewing cell division."'
                            },
                        ].map((item) => (
                            <div key={item.title} className="p-6 rounded-2xl bg-white/10 backdrop-blur border border-white/10">
                                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                                <p className="text-white/70 mb-4">{item.desc}</p>
                                <div className="p-3 rounded-lg bg-white/10 text-sm text-yellow-300 italic">
                                    {item.example}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 px-6">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            How It Works
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-4 gap-6">
                        {[
                            { step: "1", icon: GraduationCap, title: "Teacher Creates Quiz", desc: "Create questions or let AI generate them" },
                            { step: "2", icon: Users, title: "Students Join", desc: "Enter the game code on their phones" },
                            { step: "3", icon: Gamepad2, title: "Play the Game", desc: "Answer questions, compete for points" },
                            { step: "4", icon: Brain, title: "AI Feedback", desc: "Quizzy reacts and explains in real-time" },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.step} className="text-center">
                                    <div className="relative inline-flex mb-4">
                                        <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center">
                                            <Icon className="h-8 w-8 text-white" />
                                        </div>
                                        <span className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-yellow-400 text-purple-900 font-bold flex items-center justify-center text-sm">
                                            {item.step}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-white mb-2">{item.title}</h3>
                                    <p className="text-sm text-white/60">{item.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Tech Stack */}
            <section className="py-20 px-6 bg-white/5">
                <div className="mx-auto max-w-4xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-white mb-4">
                            Built With
                        </h2>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {[
                            "Gemini 2.0 Flash",
                            "Next.js 15",
                            "FastAPI",
                            "Python",
                            "TypeScript",
                            "Tailwind CSS",
                            "Piston (Code Execution)",
                        ].map((tech) => (
                            <span key={tech} className="px-4 py-2 rounded-full bg-white/10 text-white/80 text-sm font-medium">
                                {tech}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6">
                <div className="mx-auto max-w-3xl text-center">
                    <Trophy className="h-16 w-16 text-yellow-400 mx-auto mb-6" />
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Try It Out!
                    </h2>
                    <p className="text-xl text-white/70 mb-8">
                        Experience Gemini-powered learning in action
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 text-lg font-bold text-purple-600 shadow-xl hover:scale-105 transition-transform"
                        >
                            Create a Quiz
                            <ArrowRight className="h-5 w-5" />
                        </Link>
                        <Link
                            href="/join"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/20 backdrop-blur border-2 border-white/30 px-8 py-4 text-lg font-bold text-white hover:bg-white/30 transition-all"
                        >
                            Join a Game
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-white/10">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-white" />
                            <span className="font-bold text-white">Quizly</span>
                        </div>
                        <p className="text-sm text-white/60">
                            Built for the Gemini API Hackathon 2025
                        </p>
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                            <Sparkles className="h-4 w-4" />
                            Powered by Gemini AI
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    );
}
