"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import {
    LayoutDashboard,
    PlayCircle,
    PlusCircle,
    BarChart3,
    Settings,
    LogOut,
} from "lucide-react";

const navigation = [
    { name: "Dashboard", href: "/teacher", icon: LayoutDashboard },
    { name: "Sessions", href: "/teacher/sessions", icon: PlayCircle },
    { name: "Create Session", href: "/teacher/sessions/new", icon: PlusCircle },
    { name: "Analytics", href: "/teacher/analytics", icon: BarChart3 },
    { name: "Settings", href: "/teacher/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="flex h-screen w-64 fixed left-0 top-0 flex-col bg-gray-900 text-white">
            {/* Logo */}
            <div className="flex items-center gap-3 border-b border-gray-700 px-6 py-5">
                <span className="text-2xl">🎓</span>
                <span className="text-lg font-bold">PeerPulse</span>
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
                                    ? "bg-sky-600 text-white"
                                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* User section */}
            <div className="border-t border-gray-700 p-4">
                <div className="flex items-center gap-3 px-2 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-medium">
                        T
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium">Teacher</p>
                        <p className="text-xs text-gray-400">Demo Account</p>
                    </div>
                    <button className="text-gray-400 transition-colors hover:text-white">
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
