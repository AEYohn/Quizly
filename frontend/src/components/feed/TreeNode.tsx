"use client";

import { useCallback, useId } from "react";
import { Lock, Check, Users, Sparkles, Star } from "lucide-react";
import { cn } from "~/lib/utils";

export type NodeState = "locked" | "ready" | "in_progress" | "mastered" | "recommended";

export interface TreeNodeProps {
    topicId: string;
    topicName: string;
    mastery: number; // 0-100
    state: NodeState;
    peerCount: number;
    position: { x: number; y: number };
    size?: number;
    onTap: () => void;
}

const RING_STROKE = 5;

export function TreeNode({
    topicName,
    mastery,
    state,
    peerCount,
    position,
    size = 76,
    onTap,
}: TreeNodeProps) {
    const uid = useId();
    const svgSize = size + 24;
    const center = svgSize / 2;
    const ringR = size / 2 - 3;
    const circumference = 2 * Math.PI * ringR;
    const masteryFraction = Math.max(0, Math.min(100, mastery)) / 100;
    const dashOffset = circumference * (1 - masteryFraction);
    const tappable = state !== "locked";

    const handleClick = useCallback(() => {
        if (tappable) onTap();
    }, [tappable, onTap]);

    const initial = topicName.charAt(0).toUpperCase();

    // Color palette per state
    const palette = {
        mastered:    { ring: "#34d399", glow: "rgba(52,211,153,0.5)",  fill1: "#064e3b", fill2: "#022c22", text: "text-emerald-300", accent: "emerald" },
        recommended: { ring: "#4DD0E1", glow: "rgba(77,208,225,0.6)", fill1: "#004D40", fill2: "#1A1A1A", text: "text-teal-200",  accent: "teal" },
        in_progress: { ring: "#00B8D4", glow: "rgba(0,184,212,0.4)",  fill1: "#2e1065", fill2: "#0f0a2e", text: "text-gray-200",    accent: "teal" },
        ready:       { ring: "#00838F", glow: "rgba(124,58,237,0.25)", fill1: "#1a1040", fill2: "#0c0a1a", text: "text-gray-300",    accent: "teal" },
        locked:      { ring: "#374151", glow: "rgba(55,65,81,0.1)",    fill1: "#1f2937", fill2: "#111827", text: "text-gray-600",    accent: "gray" },
    } as const;
    const p = palette[state];

    const gradId = `g-${uid}`;
    const shadowId = `s-${uid}`;
    const glowId = `gl-${uid}`;

    return (
        <div
            className={cn(
                "absolute flex flex-col items-center",
                tappable ? "cursor-pointer" : "cursor-default",
                state === "locked" && "opacity-35",
            )}
            style={{
                left: `${position.x * 100}%`,
                top: position.y,
                transform: "translateX(-50%)",
            }}
            onClick={handleClick}
            role={tappable ? "button" : undefined}
            tabIndex={tappable ? 0 : undefined}
        >
            {/* Peer badge */}
            {peerCount > 0 && (
                <div
                    className="absolute z-30 flex items-center gap-0.5 rounded-full text-[9px] font-black text-white shadow-xl"
                    style={{
                        top: 0,
                        right: center - 50,
                        padding: "2px 7px",
                        background: "linear-gradient(135deg, #00838F 0%, #006064 100%)",
                        boxShadow: "0 2px 12px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
                    }}
                >
                    <Users className="w-2.5 h-2.5" />
                    {peerCount}
                </div>
            )}

            {/* Main node */}
            <div
                className={cn(
                    "relative transition-transform duration-200 ease-out",
                    tappable && "hover:scale-[1.12] active:scale-[0.92]",
                    state === "recommended" && "animate-[float_4s_ease-in-out_infinite]",
                )}
            >
                <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                    <defs>
                        <radialGradient id={gradId} cx="38%" cy="32%" r="60%">
                            <stop offset="0%" stopColor={p.fill1} />
                            <stop offset="100%" stopColor={p.fill2} />
                        </radialGradient>
                        <filter id={shadowId} x="-30%" y="-20%" width="160%" height="160%">
                            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.6" />
                        </filter>
                        {state === "recommended" && (
                            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
                                <feFlood floodColor="#4DD0E1" floodOpacity="0.3" result="color" />
                                <feComposite in="color" in2="blur" operator="in" result="glow" />
                                <feMerge>
                                    <feMergeNode in="glow" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        )}
                    </defs>

                    {/* Recommended outer pulse */}
                    {state === "recommended" && (
                        <>
                            <circle
                                cx={center} cy={center} r={ringR + 10}
                                fill="none" stroke="rgba(77,208,225,0.15)" strokeWidth="2"
                                className="animate-ping"
                                style={{ animationDuration: "3s", transformOrigin: "center" }}
                            />
                            <circle
                                cx={center} cy={center} r={ringR + 6}
                                fill="none" stroke="rgba(77,208,225,0.2)" strokeWidth="1.5"
                            />
                        </>
                    )}

                    {/* Main circle body */}
                    <circle
                        cx={center} cy={center} r={size / 2}
                        fill={`url(#${gradId})`}
                        filter={`url(#${shadowId})`}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="1"
                    />

                    {/* Inner light highlight */}
                    <circle
                        cx={center - size * 0.12} cy={center - size * 0.15}
                        r={size * 0.25}
                        fill="rgba(255,255,255,0.04)"
                    />

                    {/* Track ring */}
                    <circle
                        cx={center} cy={center} r={ringR}
                        fill="none"
                        stroke="rgba(255,255,255,0.07)"
                        strokeWidth={RING_STROKE}
                    />

                    {/* Mastery arc */}
                    {masteryFraction > 0 && (
                        <circle
                            cx={center} cy={center} r={ringR}
                            fill="none"
                            stroke={p.ring}
                            strokeWidth={RING_STROKE}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${center} ${center})`}
                            className="transition-all duration-700 ease-out"
                            style={{ filter: `drop-shadow(0 0 6px ${p.glow})` }}
                        />
                    )}

                    {/* Ready: dashed accent ring */}
                    {masteryFraction === 0 && state === "ready" && (
                        <circle
                            cx={center} cy={center} r={ringR}
                            fill="none"
                            stroke="rgba(124,58,237,0.35)"
                            strokeWidth={RING_STROKE}
                            strokeDasharray="6 10"
                        />
                    )}

                    {/* Recommended: full faint ring */}
                    {state === "recommended" && masteryFraction === 0 && (
                        <circle
                            cx={center} cy={center} r={ringR}
                            fill="none"
                            stroke="rgba(77,208,225,0.3)"
                            strokeWidth={RING_STROKE}
                        />
                    )}
                </svg>

                {/* Center icon / content */}
                <div className="absolute inset-0 flex items-center justify-center">
                    {state === "locked" ? (
                        <Lock className="w-5 h-5 text-gray-600" />
                    ) : state === "mastered" ? (
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-400/15 backdrop-blur-sm">
                            <Check className="w-5 h-5 text-emerald-400" strokeWidth={3} />
                        </div>
                    ) : state === "recommended" ? (
                        <div className="relative">
                            <Sparkles className="w-7 h-7 text-teal-200" style={{ filter: "drop-shadow(0 0 10px rgba(77,208,225,0.7))" }} />
                        </div>
                    ) : mastery > 0 ? (
                        <span className="text-[17px] font-black tabular-nums text-white/85 drop-shadow-sm">{mastery}</span>
                    ) : (
                        <span className="text-[22px] font-black text-white/40">{initial}</span>
                    )}
                </div>
            </div>

            {/* Topic name */}
            <span className={cn(
                "mt-2.5 text-[11px] font-bold text-center leading-tight max-w-[100px] line-clamp-2 tracking-wide",
                state === "mastered" ? "text-emerald-300/70" :
                    state === "recommended" ? "text-teal-200/90" :
                        state === "locked" ? "text-gray-600" :
                            "text-gray-400",
            )}>
                {topicName}
            </span>
        </div>
    );
}
