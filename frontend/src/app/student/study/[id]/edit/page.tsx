"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

// Redirect to teacher quiz creation page with edit mode
export default function EditStudyQuizPage() {
    const router = useRouter();
    const params = useParams();
    const quizId = params.id as string;

    useEffect(() => {
        if (quizId) {
            router.replace(`/teacher/quizzes/new?mode=study&editId=${quizId}`);
        }
    }, [router, quizId]);

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-4" />
                <p className="text-gray-400">Loading quiz editor...</p>
            </div>
        </div>
    );
}
