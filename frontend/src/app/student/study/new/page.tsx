"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Redirect to teacher quiz creation with study mode
export default function CreateStudyQuizPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to teacher quiz creation page with study mode parameter
        router.replace("/teacher/quizzes/new?mode=study");
    }, [router]);

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-4" />
                <p className="text-gray-400">Loading quiz creator...</p>
            </div>
        </div>
    );
}
