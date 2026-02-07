"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ScrollFeed } from "~/components/feed/ScrollFeed";
import { BottomTabBar } from "~/components/feed/BottomTabBar";
import type { TabId } from "~/components/feed/BottomTabBar";
import { useLeaderboard } from "~/hooks/feed";

// Lazy-load tabs that are not visible on initial render
const ProfilePanel = dynamic(
    () => import("~/components/feed/ProfilePanel").then((mod) => mod.ProfilePanel),
    {
        ssr: false,
        loading: () => (
            <div className="h-full flex items-center justify-center bg-gray-950" role="status" aria-label="Loading profile">
                <div className="animate-pulse space-y-4 w-full max-w-lg mx-auto px-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gray-800" />
                        <div className="space-y-2 flex-1">
                            <div className="h-4 bg-gray-800 rounded w-32" />
                            <div className="h-3 bg-gray-800 rounded w-24" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-20 rounded-2xl bg-gray-900/60 border border-gray-800/40" />
                        ))}
                    </div>
                </div>
            </div>
        ),
    },
);

const Leaderboard = dynamic(
    () => import("~/variants/cosmic/Leaderboard").then((mod) => mod.Leaderboard),
    {
        ssr: false,
        loading: () => (
            <div className="h-full flex items-center justify-center bg-gradient-to-b from-[#050510] to-[#050515]" role="status" aria-label="Loading leaderboard">
                <div className="animate-pulse space-y-4 w-full max-w-lg mx-auto px-5">
                    <div className="h-6 bg-gray-800 rounded w-40 mx-auto" />
                    <div className="flex items-end justify-center gap-3 pt-4">
                        <div className="w-24 h-32 rounded-lg bg-gray-800/40" />
                        <div className="w-24 h-40 rounded-lg bg-gray-800/40" />
                        <div className="w-24 h-28 rounded-lg bg-gray-800/40" />
                    </div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-14 rounded-xl bg-gray-800/30" />
                    ))}
                </div>
            </div>
        ),
    },
);

function LeaderboardTab() {
    const leaderboard = useLeaderboard();
    return <Leaderboard {...leaderboard} />;
}

export default function ScrollPage() {
    const [activeTab, setActiveTab] = useState<TabId>("feed");

    return (
        <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden relative">
                <div className={activeTab === "feed" ? "h-full" : "hidden"}>
                    <ScrollFeed />
                </div>
                {activeTab === "leaderboard" && (
                    <div className="h-full">
                        <LeaderboardTab />
                    </div>
                )}
                {activeTab === "profile" && (
                    <div className="h-full">
                        <ProfilePanel />
                    </div>
                )}
            </div>
            <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
    );
}
