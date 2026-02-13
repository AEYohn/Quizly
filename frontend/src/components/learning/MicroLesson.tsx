"use client";

import { BookOpen } from "lucide-react";

interface MicroLessonProps {
    title: string;
    content: string;
    concept: string;
}

export function MicroLesson({ title, content, concept }: MicroLessonProps) {
    return (
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-medium text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
                    {concept}
                </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {content}
            </div>
        </div>
    );
}
