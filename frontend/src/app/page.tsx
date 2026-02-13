"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
    Brain, Sparkles, Zap, ArrowRight, BookOpen, Target,
    Github, Upload, MessageSquare, Trophy, Play, Gamepad2,
    Code, Layers,
} from "lucide-react";
import { cn } from "~/lib/utils";

/* ─── Mockup Cards for Feature Showcase ─── */

function QuizCardMockup() {
    return (
        <div className="bg-neutral-900/60 border border-teal-400/20 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-300/70">Question 3 of 12</span>
                <span className="text-xs font-bold text-amber-300">+50 XP</span>
            </div>
            <p className="text-white font-semibold text-sm leading-relaxed">
                What is the time complexity of binary search on a sorted array?
            </p>
            <div className="space-y-2">
                {[
                    { label: "A", text: "O(n)", active: false },
                    { label: "B", text: "O(log n)", active: true },
                    { label: "C", text: "O(n log n)", active: false },
                    { label: "D", text: "O(1)", active: false },
                ].map((opt) => (
                    <div
                        key={opt.label}
                        className={cn(
                            "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all",
                            opt.active
                                ? "bg-teal-500/30 border border-teal-400/50 text-white"
                                : "bg-neutral-900/40 border border-teal-400/10 text-teal-200/60",
                        )}
                    >
                        <span className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                            opt.active ? "bg-teal-500 text-white" : "bg-teal-900/50 text-teal-300/50",
                        )}>
                            {opt.label}
                        </span>
                        <span>{opt.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SkillTreeMockup() {
    const nodes = [
        { name: "Variables", mastery: 100, x: "50%", y: "8%" },
        { name: "Functions", mastery: 85, x: "28%", y: "36%" },
        { name: "Loops", mastery: 60, x: "72%", y: "36%" },
        { name: "Arrays", mastery: 30, x: "24%", y: "66%" },
        { name: "Objects", mastery: 0, x: "76%", y: "66%" },
        { name: "Async", mastery: 0, x: "50%", y: "92%" },
    ];

    return (
        <div className="bg-neutral-900/60 border border-teal-400/20 rounded-2xl p-5 overflow-hidden">
            <div className="text-xs font-semibold uppercase tracking-wider text-teal-300/70 mb-2">JavaScript Skill Tree</div>
            {/* Tree area — relative container for absolute nodes */}
            <div className="relative h-64">
                {/* Connection lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <line x1="50%" y1="14%" x2="28%" y2="38%" stroke="rgba(38,198,218,0.2)" strokeWidth="1.5" />
                    <line x1="50%" y1="14%" x2="72%" y2="38%" stroke="rgba(38,198,218,0.2)" strokeWidth="1.5" />
                    <line x1="28%" y1="44%" x2="24%" y2="66%" stroke="rgba(38,198,218,0.15)" strokeWidth="1.5" />
                    <line x1="72%" y1="44%" x2="76%" y2="66%" stroke="rgba(38,198,218,0.1)" strokeWidth="1.5" />
                    <line x1="24%" y1="74%" x2="50%" y2="90%" stroke="rgba(38,198,218,0.08)" strokeWidth="1.5" />
                    <line x1="76%" y1="74%" x2="50%" y2="90%" stroke="rgba(38,198,218,0.08)" strokeWidth="1.5" />
                </svg>
                {/* Nodes */}
                {nodes.map((node) => {
                    const ringColor = node.mastery >= 80 ? "stroke-emerald-400" : node.mastery >= 40 ? "stroke-teal-400" : "stroke-teal-400/30";
                    const bgColor = node.mastery >= 80 ? "bg-emerald-500/20 border-emerald-400/40" : node.mastery >= 40 ? "bg-teal-500/20 border-teal-400/40" : "bg-neutral-900/60 border-teal-400/15";
                    return (
                        <div
                            key={node.name}
                            className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                            style={{ left: node.x, top: node.y }}
                        >
                            <div className={cn("relative w-10 h-10 rounded-full flex items-center justify-center border", bgColor)}>
                                <svg className="absolute inset-0 w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                                    <circle cx="20" cy="20" r="17" fill="none" className={ringColor} strokeWidth="2"
                                        strokeDasharray={`${(node.mastery / 100) * 106.8} 106.8`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <Brain className="w-4 h-4 text-teal-200/70" />
                            </div>
                            <span className="text-[10px] text-teal-200/60 mt-1 font-medium">{node.name}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CodebaseMockup() {
    return (
        <div className="bg-neutral-900/60 border border-teal-400/20 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 bg-neutral-900/80 border border-teal-400/15 rounded-xl px-4 py-3">
                <Github className="w-4 h-4 text-teal-300/60 shrink-0" />
                <span className="text-sm text-white/80 font-mono">facebook/react</span>
            </div>
            <div className="space-y-2.5">
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-400/20 rounded-xl px-4 py-2.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs text-emerald-300 font-medium">Analysis complete</span>
                </div>
                {["Fiber Architecture", "Reconciliation", "Hooks System", "JSX Transform"].map((concept) => (
                    <div key={concept} className="flex items-center justify-between bg-neutral-900/40 border border-teal-400/10 rounded-xl px-4 py-2.5">
                        <span className="text-sm text-teal-200/70">{concept}</span>
                        <Code className="w-3.5 h-3.5 text-teal-400/40" />
                    </div>
                ))}
            </div>
        </div>
    );
}

function ChatMockup() {
    return (
        <div className="bg-neutral-900/60 border border-teal-400/20 rounded-2xl p-5 space-y-3">
            <div className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-teal-500/30 border border-teal-400/30 flex items-center justify-center shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-teal-300" />
                </div>
                <div className="bg-teal-900/40 border border-teal-400/10 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm text-teal-100/80">
                    Interesting! You said O(n) — what happens when you cut the search space in half each step?
                </div>
            </div>
            <div className="flex gap-3 justify-end">
                <div className="bg-teal-500/20 border border-teal-400/20 rounded-2xl rounded-tr-none px-4 py-2.5 text-sm text-white/90">
                    Oh wait... that means we only check log n elements!
                </div>
            </div>
            <div className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-teal-500/30 border border-teal-400/30 flex items-center justify-center shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-teal-300" />
                </div>
                <div className="bg-teal-900/40 border border-teal-400/10 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm text-teal-100/80">
                    Exactly! You just discovered logarithmic time complexity. That&apos;s the power of divide and conquer.
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ─── */

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
            <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-teal-400 animate-pulse" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#0F0F0F] text-white overflow-x-hidden">
            {/* ─── Nav ─── */}
            <nav className="fixed top-0 z-50 w-full bg-[#0F0F0F]/80 backdrop-blur-xl border-b border-teal-400/10">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/20 border border-teal-400/30">
                            <Sparkles className="h-5 w-5 text-teal-300" />
                        </div>
                        <span className="text-xl font-bold text-white">Quizly</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/join"
                            className="text-sm font-medium text-teal-200/60 hover:text-white transition-colors"
                        >
                            Join Game
                        </Link>
                        <Link
                            href="/sign-in"
                            className="rounded-lg border border-teal-400/30 bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-200 hover:bg-teal-500/20 hover:border-teal-400/50 transition-all"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ─── Hero ─── */}
            <section className="relative pt-32 pb-24 px-6 overflow-hidden">
                {/* Radial glow behind headline */}
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] pointer-events-none"
                    style={{
                        background: "radial-gradient(ellipse at center, rgba(0,184,212,0.08) 0%, transparent 70%)",
                    }}
                />

                <div className="relative z-10 mx-auto max-w-4xl text-center">
                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
                        <span className="bg-gradient-to-b from-white via-white to-teal-200/80 bg-clip-text text-transparent">
                            Learn anything.
                        </span>
                        <br />
                        <span className="bg-gradient-to-r from-teal-300 via-teal-300 to-teal-300 bg-clip-text text-transparent">
                            Master everything.
                        </span>
                    </h1>

                    <p className="text-lg sm:text-xl text-teal-200/60 leading-relaxed max-w-2xl mx-auto mb-10">
                        AI-powered learning that adapts to you — quizzes, flashcards,
                        skill trees, and a personal tutor that never gives up on you.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/feed"
                            className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-teal-500 px-8 py-4 text-lg font-bold text-white hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
                        >
                            <Sparkles className="h-5 w-5" />
                            Start Learning
                            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                        <Link
                            href="/join"
                            className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-teal-400/30 bg-teal-500/10 px-8 py-4 text-lg font-medium text-teal-200 hover:bg-teal-500/20 hover:border-teal-400/50 transition-all"
                        >
                            <Gamepad2 className="h-5 w-5" />
                            Join a Game
                        </Link>
                    </div>

                    <p className="mt-8 text-sm text-teal-300/40 flex items-center justify-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" />
                        Powered by Gemini AI
                    </p>
                </div>
            </section>

            {/* ─── How It Works ─── */}
            <section className="py-20 px-6">
                <div className="mx-auto max-w-5xl">
                    <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-teal-300/50 mb-12">
                        How it works
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Upload,
                                title: "Pick a Topic",
                                desc: "Type any subject, upload a PDF, or paste a GitHub repo.",
                                accent: "from-teal-500/20 to-teal-500/5",
                                iconColor: "text-teal-300",
                                borderColor: "border-teal-400/20",
                            },
                            {
                                icon: Layers,
                                title: "AI Builds Your Path",
                                desc: "Generates a personalized skill tree with adaptive content.",
                                accent: "from-teal-500/20 to-teal-500/5",
                                iconColor: "text-teal-300",
                                borderColor: "border-teal-400/20",
                            },
                            {
                                icon: Target,
                                title: "Learn by Doing",
                                desc: "Scroll through quizzes, flashcards, and curated resources.",
                                accent: "from-emerald-500/20 to-emerald-500/5",
                                iconColor: "text-emerald-300",
                                borderColor: "border-emerald-400/20",
                            },
                        ].map((step, i) => (
                            <div key={step.title} className="text-center group">
                                <div className={cn(
                                    "inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b border mb-5 transition-all group-hover:scale-105",
                                    step.accent, step.borderColor,
                                )}>
                                    <step.icon className={cn("h-7 w-7", step.iconColor)} />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                                <p className="text-teal-200/50 text-sm leading-relaxed">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Feature Showcase ─── */}
            <section className="py-16 px-6">
                <div className="mx-auto max-w-6xl space-y-24">

                    {/* Feature A: Infinite Scroll Feed */}
                    <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 text-sm text-teal-300/60 mb-4">
                                <BookOpen className="h-4 w-4" />
                                Scroll Feed
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
                                A feed that teaches
                            </h2>
                            <p className="text-teal-200/50 leading-relaxed mb-5">
                                Swipe through AI-generated quizzes, flashcards, info cards,
                                and curated resources — all adapting to your level in real-time.
                            </p>
                            <ul className="space-y-2.5 text-sm">
                                {["Quizzes, flashcards & info cards", "Adapts to your mastery level", "Infinite content generation"].map((item) => (
                                    <li key={item} className="flex items-center gap-2.5 text-teal-200/40">
                                        <Zap className="h-3.5 w-3.5 text-teal-400/50 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <QuizCardMockup />
                    </div>

                    {/* Feature B: AI Skill Trees */}
                    <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
                        <div className="order-2 md:order-1">
                            <SkillTreeMockup />
                        </div>
                        <div className="order-1 md:order-2">
                            <div className="inline-flex items-center gap-2 text-sm text-teal-300/60 mb-4">
                                <Layers className="h-4 w-4" />
                                Skill Trees
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
                                See your knowledge grow
                            </h2>
                            <p className="text-teal-200/50 leading-relaxed mb-5">
                                Visual skill trees map every concept, track your mastery,
                                and recommend what to learn next.
                            </p>
                            <ul className="space-y-2.5 text-sm">
                                {["Visual mastery tracking", "Prerequisite mapping", "Adaptive recommendations"].map((item) => (
                                    <li key={item} className="flex items-center gap-2.5 text-teal-200/40">
                                        <Zap className="h-3.5 w-3.5 text-teal-400/50 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Feature C: Learn Any Codebase */}
                    <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 text-sm text-emerald-300/60 mb-4">
                                <Github className="h-4 w-4" />
                                Codebase Learning
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
                                Learn any codebase
                            </h2>
                            <p className="text-teal-200/50 leading-relaxed mb-5">
                                Paste a GitHub URL. Get a learning plan. Our AI analyzes repos
                                and builds custom curricula from real-world projects.
                            </p>
                            <ul className="space-y-2.5 text-sm">
                                {["Analyzes repo architecture", "Generates concept maps", "Builds learning paths from code"].map((item) => (
                                    <li key={item} className="flex items-center gap-2.5 text-teal-200/40">
                                        <Zap className="h-3.5 w-3.5 text-emerald-400/50 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <CodebaseMockup />
                    </div>

                    {/* Feature D: AI Tutor */}
                    <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
                        <div className="order-2 md:order-1">
                            <ChatMockup />
                        </div>
                        <div className="order-1 md:order-2">
                            <div className="inline-flex items-center gap-2 text-sm text-amber-300/60 mb-4">
                                <MessageSquare className="h-4 w-4" />
                                AI Tutor
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
                                A tutor that guides, not tells
                            </h2>
                            <p className="text-teal-200/50 leading-relaxed mb-5">
                                Stuck? Your AI tutor doesn&apos;t just give you the answer — it
                                guides you to understanding through Socratic conversation.
                            </p>
                            <ul className="space-y-2.5 text-sm">
                                {["Socratic questioning method", "Adapts to your reasoning", "Celebrates your breakthroughs"].map((item) => (
                                    <li key={item} className="flex items-center gap-2.5 text-teal-200/40">
                                        <Zap className="h-3.5 w-3.5 text-amber-400/50 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Stats Bar ─── */}
            <section className="py-16 px-6">
                <div className="mx-auto max-w-4xl">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Card Types", value: "4", icon: Layers, color: "text-teal-300" },
                            { label: "Adaptive Difficulty", value: "BKT", icon: Brain, color: "text-teal-300" },
                            { label: "Streak & XP", value: "Live", icon: Trophy, color: "text-amber-300" },
                            { label: "Leaderboards", value: "Real-time", icon: Play, color: "text-emerald-300" },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <div
                                key={label}
                                className="bg-neutral-900/40 border border-teal-400/15 rounded-2xl p-5 text-center"
                            >
                                <Icon className={cn("w-5 h-5 mx-auto mb-3", color)} />
                                <div className="text-lg font-bold text-white">{value}</div>
                                <div className="text-xs text-teal-200/40 uppercase tracking-wider mt-1">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Final CTA ─── */}
            <section className="relative py-24 px-6">
                {/* Subtle glow */}
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] pointer-events-none"
                    style={{
                        background: "radial-gradient(ellipse at center, rgba(0,184,212,0.06) 0%, transparent 70%)",
                    }}
                />
                <div className="relative z-10 mx-auto max-w-2xl text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                        Ready to learn?
                    </h2>
                    <p className="text-teal-200/50 mb-8">
                        Start your learning journey — no credit card, no catch.
                    </p>
                    <Link
                        href="/feed"
                        className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-teal-500 px-8 py-4 text-lg font-bold text-white hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
                    >
                        <Sparkles className="h-5 w-5" />
                        Start Learning
                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <div className="mt-5">
                        <Link
                            href="/join"
                            className="text-sm text-teal-300/40 hover:text-teal-300/70 transition-colors"
                        >
                            or join a live game →
                        </Link>
                    </div>
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="py-8 px-6 border-t border-teal-400/10">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-teal-400/50" />
                            <span className="font-bold text-white/80">Quizly</span>
                        </div>
                        <p className="text-sm text-teal-200/30">
                            Powered by Gemini AI
                        </p>
                    </div>
                </div>
            </footer>
        </main>
    );
}
