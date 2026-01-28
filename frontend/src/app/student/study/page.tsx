"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// This page has been consolidated into the main student dashboard
export default function StudyPageRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/student/dashboard");
    }, [router]);

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500 mx-auto mb-4" />
                <p className="text-gray-400">Redirecting to dashboard...</p>
            </div>
        </div>
    );
}
