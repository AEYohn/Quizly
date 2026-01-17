import Link from "next/link";

export default function Home() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-purple-50">
            {/* Hero Section */}
            <div className="flex min-h-screen flex-col items-center justify-center px-6">
                <div className="max-w-3xl animate-fade-in text-center">
                    {/* Logo */}
                    <div className="mb-8">
                        <span className="text-6xl">🎓</span>
                    </div>

                    {/* Title */}
                    <h1 className="mb-4 text-5xl font-bold">
                        <span className="bg-gradient-to-r from-sky-600 to-purple-600 bg-clip-text text-transparent">
                            Quizly
                        </span>
                    </h1>

                    <p className="mb-8 text-xl text-gray-600">
                        AI-Powered Peer Instruction Platform
                    </p>

                    <p className="mx-auto mb-12 max-w-xl text-gray-500">
                        Transform your lectures into dynamic, discussion-driven learning
                        experiences with autonomous question generation and real-time class
                        analytics.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col justify-center gap-4 sm:flex-row">
                        <Link
                            href="/teacher"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-8 py-3 text-lg font-medium text-white shadow-sm transition-all hover:bg-sky-700 hover:shadow-md"
                        >
                            <span>👨‍🏫</span>
                            Teacher Dashboard
                        </Link>

                        <Link
                            href="/student"
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-8 py-3 text-lg font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
                        >
                            <span>🎒</span>
                            Join as Student
                        </Link>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="mt-24 grid max-w-4xl animate-slide-in grid-cols-1 gap-6 md:grid-cols-3">
                    <FeatureCard
                        emoji="🤖"
                        title="AI Question Generation"
                        description="Automatically generate conceptual questions targeting common misconceptions"
                    />
                    <FeatureCard
                        emoji="📊"
                        title="Real-time Analytics"
                        description="Monitor class pulse with live response distributions and confidence metrics"
                    />
                    <FeatureCard
                        emoji="🎯"
                        title="Adaptive Learning"
                        description="Personalized exit tickets and remediation based on individual performance"
                    />
                </div>
            </div>
        </main>
    );
}

function FeatureCard({
    emoji,
    title,
    description,
}: {
    emoji: string;
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-3 text-3xl">{emoji}</div>
            <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
        </div>
    );
}
