"use client";

import { Sidebar } from "~/components/ui/Sidebar";

export default function TeacherLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-950">
            <Sidebar />
            <main
                className="min-h-screen transition-[margin-left] duration-200"
                style={{ marginLeft: "var(--sidebar-width, 256px)" }}
            >
                {children}
            </main>
        </div>
    );
}
