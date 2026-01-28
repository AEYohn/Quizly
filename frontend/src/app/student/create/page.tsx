"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
    BookOpen, StickyNote, Gamepad2, Layers,
    Upload, Sparkles, ArrowLeft
} from "lucide-react";

const contentTypes = [
    {
        id: "flashcards",
        title: "Flashcard Deck",
        description: "Create cards to memorize terms, definitions, and concepts",
        icon: BookOpen,
        href: "/student/create/flashcards",
        color: "bg-blue-600"
    },
    {
        id: "notes",
        title: "Study Notes",
        description: "Write and organize your notes with rich formatting",
        icon: StickyNote,
        href: "/student/create/notes",
        color: "bg-green-600"
    },
    {
        id: "game",
        title: "Learning Game",
        description: "Create fun games to practice and test yourself",
        icon: Gamepad2,
        href: "/student/create/game",
        color: "bg-purple-600"
    },
    {
        id: "quiz",
        title: "Practice Quiz",
        description: "Build quizzes with multiple choice questions",
        icon: Layers,
        href: "/student/create/quiz",
        color: "bg-orange-600"
    }
];

const quickActions = [
    {
        id: "ai-generate",
        title: "Generate with AI",
        description: "Describe a topic and let AI create study materials for you",
        icon: Sparkles,
        href: "/student/create/ai"
    },
    {
        id: "import",
        title: "Import Content",
        description: "Upload PDFs, images, or paste text to convert into study materials",
        icon: Upload,
        href: "/student/create/import"
    }
];

export default function CreatePage() {
    const router = useRouter();
    const { user: clerkUser, isLoaded } = useUser();

    if (isLoaded && !clerkUser) {
        router.push("/student");
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href="/student/library"
                        className="p-2 hover:bg-gray-800 rounded-lg"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Create New</h1>
                        <p className="text-gray-400">Choose what you want to create</p>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {quickActions.map(action => (
                            <Link
                                key={action.id}
                                href={action.href}
                                className="flex items-start gap-4 p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500 transition-colors"
                            >
                                <div className="p-3 bg-blue-600/20 rounded-lg">
                                    <action.icon className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">{action.title}</h3>
                                    <p className="text-sm text-gray-400">{action.description}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Content Types */}
                <div>
                    <h2 className="text-lg font-semibold mb-4">Create from Scratch</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {contentTypes.map(type => (
                            <Link
                                key={type.id}
                                href={type.href}
                                className="flex items-start gap-4 p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors group"
                            >
                                <div className={`p-3 ${type.color} rounded-lg`}>
                                    <type.icon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1 group-hover:text-blue-400 transition-colors">
                                        {type.title}
                                    </h3>
                                    <p className="text-sm text-gray-400">{type.description}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
