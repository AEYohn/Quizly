"use client";

import { type ReactNode } from "react";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";

interface OnboardingStepAction {
    label: string;
    onClick: () => void;
}

interface OnboardingStepProps {
    icon: LucideIcon;
    title: string;
    description: string;
    isComplete: boolean;
    isCurrent: boolean;
    action?: OnboardingStepAction;
    children?: ReactNode;
}

export function OnboardingStep({
    icon: Icon,
    title,
    description,
    isComplete,
    isCurrent,
    action,
    children,
}: OnboardingStepProps) {
    return (
        <div
            className={`
                relative p-4 rounded-xl border transition-all duration-200
                ${
                    isComplete
                        ? "bg-green-500/10 border-green-500/30"
                        : isCurrent
                        ? "bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                        : "bg-gray-800/50 border-gray-700/50 opacity-60"
                }
            `}
        >
            <div className="flex items-start gap-4">
                {/* Icon container */}
                <div
                    className={`
                        flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                        ${
                            isComplete
                                ? "bg-green-500/20"
                                : isCurrent
                                ? "bg-indigo-500/20"
                                : "bg-gray-700/50"
                        }
                    `}
                >
                    {isComplete ? (
                        <Check className="w-5 h-5 text-green-400" />
                    ) : (
                        <Icon
                            className={`w-5 h-5 ${
                                isCurrent ? "text-indigo-400" : "text-gray-500"
                            }`}
                        />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3
                        className={`
                            font-semibold mb-1
                            ${
                                isComplete
                                    ? "text-green-400"
                                    : isCurrent
                                    ? "text-white"
                                    : "text-gray-400"
                            }
                        `}
                    >
                        {title}
                    </h3>
                    <p
                        className={`
                            text-sm
                            ${
                                isComplete
                                    ? "text-green-400/70"
                                    : isCurrent
                                    ? "text-gray-300"
                                    : "text-gray-500"
                            }
                        `}
                    >
                        {description}
                    </p>

                    {/* Children content */}
                    {children && isCurrent && (
                        <div className="mt-3">{children}</div>
                    )}

                    {/* Action button - only show when current and not complete */}
                    {action && isCurrent && !isComplete && (
                        <button
                            onClick={action.onClick}
                            className="
                                mt-3 inline-flex items-center gap-2 px-4 py-2
                                bg-indigo-600 hover:bg-indigo-500
                                text-white text-sm font-medium
                                rounded-lg transition-colors
                            "
                        >
                            {action.label}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Status indicator */}
                {isComplete && (
                    <div className="flex-shrink-0">
                        <span className="text-xs font-medium text-green-400 bg-green-500/20 px-2 py-1 rounded-full">
                            Done
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
