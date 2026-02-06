"use client";

import { Zap, Trophy, User } from "lucide-react";
import { cn } from "~/lib/utils";

export type TabId = "feed" | "leaderboard" | "profile";

const TABS: { id: TabId; label: string; icon: typeof Zap }[] = [
    { id: "feed", label: "Feed", icon: Zap },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
    { id: "profile", label: "Profile", icon: User },
];

interface BottomTabBarProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
    return (
        <nav className="shrink-0 bg-gray-950/95 backdrop-blur-sm border-t border-gray-800/40 pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-around h-14">
                {TABS.map(({ id, label, icon: Icon }) => {
                    const active = activeTab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => onTabChange(id)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                                active ? "text-violet-400" : "text-gray-500",
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="text-[10px] font-medium">{label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
