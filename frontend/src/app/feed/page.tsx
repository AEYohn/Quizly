"use client";

import { useState, useEffect } from "react";
import { ThemeProvider } from "~/themes/ThemeProvider";
import { BottomTabBar } from "~/components/feed/BottomTabBar";
import type { TabId } from "~/components/feed/BottomTabBar";
import type { VariantComponents } from "~/variants/contracts";
import { loadVariant } from "~/variants";
import { useLeaderboard, useProfile } from "~/hooks/feed";

function LoadingScreen() {
    return (
        <div className="h-screen bg-[#050510] flex items-center justify-center">
            <div className="text-center space-y-3">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin mx-auto" />
                <p className="text-indigo-200 text-sm">Loading...</p>
            </div>
        </div>
    );
}

function LeaderboardTab({ components }: { components: VariantComponents }) {
    const leaderboard = useLeaderboard();
    const Leaderboard = components.Leaderboard;
    return <Leaderboard {...leaderboard} />;
}

function ProfileTab({ components }: { components: VariantComponents }) {
    const profile = useProfile();
    const Profile = components.Profile;
    return <Profile {...profile} />;
}

export default function FeedPage() {
    const [activeTab, setActiveTab] = useState<TabId>("feed");
    const [components, setComponents] = useState<VariantComponents | null>(null);

    useEffect(() => {
        loadVariant().then(setComponents);
    }, []);

    if (!components) return <LoadingScreen />;

    const { Feed } = components;

    return (
        <ThemeProvider>
            <div className="h-screen bg-[#050510] flex flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden relative">
                    <div className={activeTab === "feed" ? "h-full" : "hidden"}>
                        <Feed />
                    </div>
                    {activeTab === "leaderboard" && (
                        <div className="h-full">
                            <LeaderboardTab components={components} />
                        </div>
                    )}
                    {activeTab === "profile" && (
                        <div className="h-full">
                            <ProfileTab components={components} />
                        </div>
                    )}
                </div>
                <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
        </ThemeProvider>
    );
}
