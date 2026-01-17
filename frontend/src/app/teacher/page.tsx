import Link from "next/link";
import {
    PlayCircle,
    PlusCircle,
    Users,
    TrendingUp,
    Clock,
    CheckCircle,
} from "lucide-react";

export default function TeacherDashboard() {
    return (
        <div className="p-8">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="mt-1 text-gray-500">
                    Welcome back! Here&apos;s an overview of your sessions.
                </p>
            </header>

            {/* Stats Grid */}
            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={<PlayCircle className="h-5 w-5" />}
                    label="Active Sessions"
                    value="2"
                    color="green"
                />
                <StatCard
                    icon={<Users className="h-5 w-5" />}
                    label="Total Students"
                    value="156"
                    color="blue"
                />
                <StatCard
                    icon={<CheckCircle className="h-5 w-5" />}
                    label="Questions Asked"
                    value="342"
                    color="purple"
                />
                <StatCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    label="Avg. Correctness"
                    value="78%"
                    color="amber"
                />
            </div>

            {/* Quick Actions */}
            <section className="mb-8">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Quick Actions
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Link
                        href="/teacher/sessions/new"
                        className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                    >
                        <div className="rounded-lg bg-sky-100 p-3 text-sky-600 transition-colors group-hover:bg-sky-600 group-hover:text-white">
                            <PlusCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">
                                Create New Session
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Design a new quiz session with AI-generated questions
                            </p>
                        </div>
                    </Link>

                    <Link
                        href="/teacher/sessions"
                        className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                    >
                        <div className="rounded-lg bg-green-100 p-3 text-green-600 transition-colors group-hover:bg-green-600 group-hover:text-white">
                            <PlayCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Start Session</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Launch a prepared session for your class
                            </p>
                        </div>
                    </Link>

                    <Link
                        href="/teacher/analytics"
                        className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                    >
                        <div className="rounded-lg bg-purple-100 p-3 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">View Analytics</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Analyze student performance and trends
                            </p>
                        </div>
                    </Link>
                </div>
            </section>

            {/* Recent Sessions */}
            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Recent Sessions
                    </h2>
                    <Link
                        href="/teacher/sessions"
                        className="text-sm font-medium text-sky-600 hover:text-sky-700"
                    >
                        View all →
                    </Link>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                    <table className="w-full">
                        <thead className="border-b border-gray-100 bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Session
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Students
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Date
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <SessionRow
                                topic="Newton's Laws of Motion"
                                status="active"
                                students={32}
                                date="Today, 2:30 PM"
                            />
                            <SessionRow
                                topic="Conservation of Energy"
                                status="completed"
                                students={28}
                                date="Yesterday"
                            />
                            <SessionRow
                                topic="Wave Mechanics"
                                status="draft"
                                students={0}
                                date="Jan 15, 2026"
                            />
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: "green" | "blue" | "purple" | "amber";
}) {
    const colors = {
        green: "bg-green-100 text-green-600",
        blue: "bg-blue-100 text-blue-600",
        purple: "bg-purple-100 text-purple-600",
        amber: "bg-amber-100 text-amber-600",
    };

    return (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
                <div className={`rounded-lg p-3 ${colors[color]}`}>{icon}</div>
                <div>
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
            </div>
        </div>
    );
}

function SessionRow({
    topic,
    status,
    students,
    date,
}: {
    topic: string;
    status: "active" | "completed" | "draft";
    students: number;
    date: string;
}) {
    const statusStyles = {
        active: "bg-green-100 text-green-700",
        completed: "bg-blue-100 text-blue-700",
        draft: "bg-gray-100 text-gray-600",
    };

    return (
        <tr className="transition-colors hover:bg-gray-50">
            <td className="px-6 py-4">
                <div className="font-medium text-gray-900">{topic}</div>
            </td>
            <td className="px-6 py-4">
                <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
                >
                    {status === "active" && (
                        <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                    )}
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
            </td>
            <td className="px-6 py-4 text-gray-500">
                {students > 0 ? `${students} joined` : "—"}
            </td>
            <td className="px-6 py-4 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {date}
                </div>
            </td>
            <td className="px-6 py-4 text-right">
                {status === "draft" && (
                    <button className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-700">
                        Start
                    </button>
                )}
                {status === "active" && (
                    <button className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                        Control
                    </button>
                )}
                {status === "completed" && (
                    <button className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                        View
                    </button>
                )}
            </td>
        </tr>
    );
}
