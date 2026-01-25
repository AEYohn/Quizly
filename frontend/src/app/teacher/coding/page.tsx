"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page is deprecated - redirects to the unified Library
export default function CodingRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/teacher/library?filter=coding");
    }, [router]);

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <p className="text-gray-400">Redirecting to Library...</p>
        </div>
    );
}
