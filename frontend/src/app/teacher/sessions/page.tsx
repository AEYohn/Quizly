import Link from "next/link";
import { PlusCircle, Search, Filter, Clock, Users } from "lucide-react";

export default function SessionsPage() {
    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
                    <p className="mt-1 text-gray-500">
                        Manage and launch your quiz sessions
                    </p>
                </div>
                <Link
                    href="/teacher/sessions/new"
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700"
                >
                    <PlusCircle className="h-4 w-4" />
                    New Session
                </Link>
            </div>

            {/* Filters */}
            <div className="mb-6 flex items-center gap-4">
                <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search sessions..."
                        className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    />
                </div>
                <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50">
                    <Filter className="h-4 w-4" />
                    Filter
                </button>
            </div>

            {/* Session Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <SessionCard
                    topic="Newton's Laws of Motion"
                    concepts={["Inertia", "F=ma", "Action-Reaction"]}
                    status="active"
                    students={32}
                    questions={8}
                    date="Today, 2:30 PM"
                />
                <SessionCard
                    topic="Conservation of Energy"
                    concepts={["Kinetic Energy", "Potential Energy", "Work"]}
                    status="completed"
                    students={28}
                    questions={6}
                    date="Yesterday"
                />
                <SessionCard
                    topic="Wave Mechanics"
                    concepts={["Frequency", "Wavelength", "Amplitude"]}
                    status="draft"
                    students={0}
                    questions={10}
                    date="Jan 15, 2026"
                />
                <SessionCard
                    topic="Thermodynamics Basics"
                    concepts={["Heat", "Temperature", "Entropy"]}
                    status="draft"
                    students={0}
                    questions={7}
                    date="Jan 14, 2026"
                />
            </div>
        </div>
    );
}

function SessionCard({
    topic,
    concepts,
    status,
    students,
    questions,
    date,
}: {
    topic: string;
    concepts: string[];
    status: "active" | "completed" | "draft";
    students: number;
    questions: number;
    date: string;
}) {
    const statusStyles = {
        active: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
        completed: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
        draft: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
    };

    const style = statusStyles[status];

    return (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-gray-200 hover:shadow-md">
            {/* Status Badge */}
            <div className="mb-4 flex items-center justify-between">
                <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}
                >
                    {status === "active" && (
                        <span
                            className={`mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full ${style.dot}`}
                        />
                    )}
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    {date}
                </span>
            </div>

            {/* Topic */}
            <h3 className="mb-2 text-lg font-semibold text-gray-900">{topic}</h3>

            {/* Concepts */}
            <div className="mb-4 flex flex-wrap gap-1.5">
                {concepts.map((concept) => (
                    <span
                        key={concept}
                        className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                        {concept}
                    </span>
                ))}
            </div>

            {/* Stats */}
            <div className="mb-4 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {students > 0 ? `${students} students` : "No students"}
                </span>
                <span>{questions} questions</span>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-100 pt-4">
                {status === "draft" && (
                    <div className="flex gap-2">
                        <button className="flex-1 rounded-lg bg-sky-600 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700">
                            Start Session
                        </button>
                        <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                            Edit
                        </button>
                    </div>
                )}
                {status === "active" && (
                    <button className="w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                        Open Control Panel
                    </button>
                )}
                {status === "completed" && (
                    <button className="w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                        View Results
                    </button>
                )}
            </div>
        </div>
    );
}
