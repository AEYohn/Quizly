"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "~/lib/utils";
import {
    LayoutDashboard,
    Library,
    Code2,
    LogOut,
    Sparkles,
} from "lucide-react";

const navigation = [
    { name: "Dashboard", href: "/teacher", icon: LayoutDashboard },
    { name: "My Quizzes", href: "/teacher/quizzes", icon: Library },
    { name: "Coding", href: "/teacher/coding", icon: Code2 },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/login");
    };

    return (
        <aside className="flex h-screen w-64 fixed left-0 top-0 flex-col bg-gray-900 text-white">
            {/* Logo */}
            <div className="flex items-center gap-3 border-b border-gray-700 px-6 py-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                    <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold">Quizly</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.map((item) => {
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/teacher" && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-purple-600 text-white"
                                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Powered by Gemini */}
            <div className="px-4 py-3 border-t border-gray-800">
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <Sparkles className="h-3 w-3" />
                    Powered by Gemini AI
                </div>
            </div>

            {/* User section */}
            <div className="border-t border-gray-700 p-4">
                <div className="flex items-center gap-3 px-2 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-sm font-medium">
                        T
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium">Teacher</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-gray-400 transition-colors hover:text-white"
                        title="Logout"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
