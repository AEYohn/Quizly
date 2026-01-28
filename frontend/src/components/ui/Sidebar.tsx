"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import Image from "next/image";
import { cn } from "~/lib/utils";
import {
    LogOut,
    Sparkles,
    PanelLeftClose,
    PanelLeft,
    Pencil,
    Users,
    Library,
    BarChart3,
} from "lucide-react";
import { ProfileModal } from "~/components/ProfileModal";

const navigation = [
    { name: "Library", href: "/teacher/library", icon: Library },
    { name: "Classrooms", href: "/teacher/classrooms", icon: Users },
    { name: "Analytics", href: "/teacher/analytics", icon: BarChart3 },
];

const EXPANDED_WIDTH = 256;
const COLLAPSED_WIDTH = 64;

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useUser();
    const { signOut } = useClerk();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [customName, setCustomName] = useState<string | null>(null);
    const [showProfileModal, setShowProfileModal] = useState(false);

    // Load saved state from localStorage
    useEffect(() => {
        const savedCollapsed = localStorage.getItem("sidebarCollapsed");
        if (savedCollapsed) {
            setIsCollapsed(savedCollapsed === "true");
        }
        // Load custom display name
        const savedName = localStorage.getItem("quizly_display_name");
        if (savedName) {
            setCustomName(savedName);
        }
    }, []);

    const toggleCollapse = useCallback(() => {
        setIsCollapsed((prev) => {
            const newValue = !prev;
            localStorage.setItem("sidebarCollapsed", String(newValue));
            return newValue;
        });
    }, []);

    const handleLogout = async () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("quizly_user");
        localStorage.removeItem("quizly_display_name");
        localStorage.removeItem("quizly_first_name");
        localStorage.removeItem("quizly_last_name");
        await signOut();
        router.push("/");
    };

    // Get user display info - prefer custom name, then Clerk data
    const clerkName = user?.firstName || user?.username || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "User";
    const displayName = customName || clerkName;
    const profileImage = user?.imageUrl;
    const initials = displayName.charAt(0).toUpperCase();

    const actualWidth = isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

    // Update CSS variable for main content margin
    useEffect(() => {
        document.documentElement.style.setProperty("--sidebar-width", `${actualWidth}px`);
    }, [actualWidth]);

    return (
        <aside
            className={cn(
                "flex h-screen fixed left-0 top-0 flex-col bg-gray-900 text-white transition-all duration-200",
                isCollapsed ? "w-16" : "w-64"
            )}
        >
            {/* Logo */}
            <div className={cn(
                "flex items-center border-b border-gray-700 py-5 transition-all",
                isCollapsed ? "justify-center px-2" : "gap-3 px-6"
            )}>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                    <Sparkles className="h-5 w-5 text-white" />
                </div>
                {!isCollapsed && <span className="text-lg font-bold">Quizly</span>}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.map((item) => {
                    const isActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href) ||
                        (item.href === "/teacher/library" && pathname === "/teacher");

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-purple-600 text-white"
                                    : "text-gray-300 hover:bg-gray-800 hover:text-white",
                                isCollapsed && "justify-center px-2"
                            )}
                            title={isCollapsed ? item.name : undefined}
                        >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            {!isCollapsed && item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Powered by Gemini */}
            {!isCollapsed && (
                <div className="px-4 py-3 border-t border-gray-800">
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                        <Sparkles className="h-3 w-3" />
                        Powered by Gemini AI
                    </div>
                </div>
            )}

            {/* User section */}
            <div className="border-t border-gray-700 p-4">
                <div className={cn(
                    "flex items-center gap-3 px-2 py-2",
                    isCollapsed && "justify-center px-0"
                )}>
                    <button
                        onClick={() => setShowProfileModal(true)}
                        className="flex-shrink-0 hover:opacity-80 transition-opacity"
                        title="Edit profile"
                    >
                        {profileImage ? (
                            <Image
                                src={profileImage}
                                alt={displayName}
                                width={32}
                                height={32}
                                className="h-8 w-8 rounded-full object-cover"
                            />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-sm font-medium">
                                {initials}
                            </div>
                        )}
                    </button>
                    {!isCollapsed && (
                        <>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{displayName}</p>
                            </div>
                            <button
                                onClick={() => setShowProfileModal(true)}
                                className="text-gray-400 transition-colors hover:text-white"
                                title="Edit profile"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button
                                onClick={handleLogout}
                                className="text-gray-400 transition-colors hover:text-white"
                                title="Logout"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Profile Modal */}
            <ProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
            />

            {/* Collapse toggle button */}
            <button
                onClick={toggleCollapse}
                className={cn(
                    "flex items-center gap-2 px-4 py-3 border-t border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors",
                    isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {isCollapsed ? (
                    <PanelLeft className="h-5 w-5" />
                ) : (
                    <>
                        <PanelLeftClose className="h-5 w-5" />
                        <span className="text-sm">Collapse</span>
                    </>
                )}
            </button>
        </aside>
    );
}
