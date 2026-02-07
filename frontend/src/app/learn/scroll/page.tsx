"use client";

import { useState } from "react";
import { ScrollFeed } from "~/components/feed/ScrollFeed";
import { BottomTabBar } from "~/components/feed/BottomTabBar";
import type { TabId } from "~/components/feed/BottomTabBar";
import { ProfilePanel } from "~/components/feed/ProfilePanel";
import { Leaderboard } from "~/variants/cosmic/Leaderboard";
import { useLeaderboard } from "~/hooks/feed";

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
