"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
    Home, BookOpen, Code2, Trophy, User, Search, 
    ChevronDown, LogOut, Settings, Menu, X 
} from "lucide-react";

export function StudentNav() {
    const pathname = usePathname();
    const [studentName, setStudentName] = useState("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    useEffect(() => {
        const name = localStorage.getItem("quizly_student_name");
        if (name) setStudentName(name);
    }, []);

    const navItems = [
        { href: "/student/dashboard", label: "Dashboard", icon: Home },
        { href: "/student/browse", label: "Browse", icon: Search },
        { href: "/play/coding", label: "Coding", icon: Code2 },
        { href: "/join", label: "Compete", icon: Trophy },
    ];

    const isActive = (href: string) => {
        if (href === "/student/dashboard") {
            return pathname === "/student/dashboard" || pathname === "/student";
        }
        return pathname.startsWith(href);
    };

    const handleSignOut = () => {
        localStorage.removeItem("quizly_student_name");
        localStorage.removeItem("quizly_student_id");
        window.location.href = "/";
    };

    return (
        <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl">
            <div className="mx-auto max-w-6xl px-6">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-2xl">🎓</span>
                        <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            Quizly
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                                        isActive(item.href)
                                            ? "bg-indigo-500/20 text-indigo-400"
                                            : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Profile Dropdown */}
                    <div className="hidden md:flex items-center gap-4">
                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-sm font-bold text-white">
                                    {studentName.charAt(0).toUpperCase() || "?"}
                                </div>
                                <span className="text-sm font-medium text-gray-300">
                                    {studentName || "Student"}
                                </span>
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                            </button>

                            {isProfileOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0" 
                                        onClick={() => setIsProfileOpen(false)} 
                                    />
                                    <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-700 bg-gray-800 py-2 shadow-xl">
                                        <div className="px-4 py-2 border-b border-gray-700">
                                            <p className="text-sm font-medium text-white">{studentName}</p>
                                            <p className="text-xs text-gray-400">Student Account</p>
                                        </div>
                                        <Link
                                            href="/student/dashboard"
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                                            onClick={() => setIsProfileOpen(false)}
                                        >
                                            <User className="h-4 w-4" />
                                            Profile
                                        </Link>
                                        <Link
                                            href="/student/settings"
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                                            onClick={() => setIsProfileOpen(false)}
                                        >
                                            <Settings className="h-4 w-4" />
                                            Settings
                                        </Link>
                                        <button
                                            onClick={handleSignOut}
                                            className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Sign Out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden rounded-lg p-2 hover:bg-gray-800"
                    >
                        {isMenuOpen ? (
                            <X className="h-6 w-6 text-gray-300" />
                        ) : (
                            <Menu className="h-6 w-6 text-gray-300" />
                        )}
                    </button>
                </div>

                {/* Mobile Navigation */}
                {isMenuOpen && (
                    <div className="md:hidden py-4 border-t border-gray-800">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                                        isActive(item.href)
                                            ? "bg-indigo-500/20 text-indigo-400"
                                            : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                    }`}
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <Icon className="h-5 w-5" />
                                    {item.label}
                                </Link>
                            );
                        })}
                        <div className="mt-4 pt-4 border-t border-gray-800">
                            <div className="flex items-center gap-3 px-4 py-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-sm font-bold text-white">
                                    {studentName.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">{studentName || "Student"}</p>
                                    <p className="text-xs text-gray-400">Student Account</p>
                                </div>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-red-400 hover:bg-gray-800 mt-2"
                            >
                                <LogOut className="h-5 w-5" />
                                Sign Out
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}

export default StudentNav;
