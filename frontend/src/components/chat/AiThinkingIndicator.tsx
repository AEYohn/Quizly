"use client";

export function AiThinkingIndicator() {
    return (
        <div className="flex justify-start">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    <span className="ml-2 text-xs text-gray-400">Thinking...</span>
                </div>
            </div>
        </div>
    );
}
