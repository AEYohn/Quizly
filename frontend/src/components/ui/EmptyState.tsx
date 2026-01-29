"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";
import {
    BookOpen,
    FileQuestion,
    Users,
    Trophy,
    Inbox,
    Search,
    Plus,
    type LucideIcon,
} from "lucide-react";

// ============================================
// Base EmptyState Component
// ============================================

interface EmptyStateProps {
    /**
     * Icon to display (Lucide icon component or custom ReactNode)
     */
    icon?: LucideIcon | ReactNode;
    /**
     * Main title text
     */
    title: string;
    /**
     * Descriptive text below the title
     */
    description?: string;
    /**
     * Optional action button configuration
     */
    action?: {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
    };
    /**
     * Custom action element (alternative to action prop)
     */
    actionElement?: ReactNode;
    /**
     * Size variant
     * @default "md"
     */
    size?: "sm" | "md" | "lg";
    className?: string;
}

const sizeStyles = {
    sm: {
        container: "py-8",
        iconWrapper: "h-12 w-12",
        icon: "h-6 w-6",
        title: "text-base",
        description: "text-xs",
        button: "px-3 py-1.5 text-sm",
    },
    md: {
        container: "py-12",
        iconWrapper: "h-16 w-16",
        icon: "h-8 w-8",
        title: "text-lg",
        description: "text-sm",
        button: "px-4 py-2 text-sm",
    },
    lg: {
        container: "py-16",
        iconWrapper: "h-20 w-20",
        icon: "h-10 w-10",
        title: "text-xl",
        description: "text-base",
        button: "px-5 py-2.5 text-base",
    },
};

/**
 * Generic empty state component for displaying placeholder content
 * when lists or views have no data.
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
    actionElement,
    size = "md",
    className,
}: EmptyStateProps) {
    const styles = sizeStyles[size];

    // Render icon - handles both LucideIcon components and ReactNode
    const renderIcon = () => {
        if (!icon) return null;

        // Check if it's a Lucide icon (function component)
        if (typeof icon === "function") {
            const IconComponent = icon as LucideIcon;
            return <IconComponent className={cn(styles.icon, "text-gray-400")} />;
        }

        // Otherwise render as ReactNode
        return icon;
    };

    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center",
                styles.container,
                className
            )}
        >
            {icon && (
                <div
                    className={cn(
                        "mb-4 flex items-center justify-center rounded-full bg-gray-800 border border-gray-700",
                        styles.iconWrapper
                    )}
                >
                    {renderIcon()}
                </div>
            )}
            <h3 className={cn("font-semibold text-white", styles.title)}>
                {title}
            </h3>
            {description && (
                <p
                    className={cn(
                        "mt-2 max-w-md text-gray-400",
                        styles.description
                    )}
                >
                    {description}
                </p>
            )}
            {(action || actionElement) && (
                <div className="mt-6">
                    {actionElement ||
                        (action && (
                            <button
                                onClick={action.onClick}
                                className={cn(
                                    "inline-flex items-center gap-2 rounded-xl bg-sky-600 font-medium text-white transition-all hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-900",
                                    styles.button
                                )}
                            >
                                {action.icon && (
                                    <action.icon className="h-4 w-4" />
                                )}
                                {action.label}
                            </button>
                        ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// EmptyCoursesState Component
// ============================================

interface EmptyCoursesStateProps {
    /**
     * Callback when "Create Course" button is clicked
     */
    onCreateCourse?: () => void;
    /**
     * Whether to show the create action button
     * @default true
     */
    showAction?: boolean;
    /**
     * Size variant
     * @default "md"
     */
    size?: "sm" | "md" | "lg";
    className?: string;
}

/**
 * Empty state for course lists when no courses exist.
 */
export function EmptyCoursesState({
    onCreateCourse,
    showAction = true,
    size = "md",
    className,
}: EmptyCoursesStateProps) {
    return (
        <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Create your first course to start organizing quizzes and tracking student progress."
            action={
                showAction && onCreateCourse
                    ? {
                          label: "Create Course",
                          onClick: onCreateCourse,
                          icon: Plus,
                      }
                    : undefined
            }
            size={size}
            className={className}
        />
    );
}

// ============================================
// EmptyQuizzesState Component
// ============================================

interface EmptyQuizzesStateProps {
    /**
     * Callback when "Create Quiz" button is clicked
     */
    onCreateQuiz?: () => void;
    /**
     * Whether to show the create action button
     * @default true
     */
    showAction?: boolean;
    /**
     * Size variant
     * @default "md"
     */
    size?: "sm" | "md" | "lg";
    className?: string;
}

/**
 * Empty state for quiz lists when no quizzes exist.
 */
export function EmptyQuizzesState({
    onCreateQuiz,
    showAction = true,
    size = "md",
    className,
}: EmptyQuizzesStateProps) {
    return (
        <EmptyState
            icon={FileQuestion}
            title="No quizzes yet"
            description="Create your first quiz to assess student knowledge and track learning outcomes."
            action={
                showAction && onCreateQuiz
                    ? {
                          label: "Create Quiz",
                          onClick: onCreateQuiz,
                          icon: Plus,
                      }
                    : undefined
            }
            size={size}
            className={className}
        />
    );
}

// ============================================
// EmptyStudentsState Component
// ============================================

interface EmptyStudentsStateProps {
    /**
     * Callback when "Invite Students" button is clicked
     */
    onInviteStudents?: () => void;
    /**
     * Whether to show the invite action button
     * @default true
     */
    showAction?: boolean;
    /**
     * Size variant
     * @default "md"
     */
    size?: "sm" | "md" | "lg";
    className?: string;
}

/**
 * Empty state for student enrollment lists when no students are enrolled.
 */
export function EmptyStudentsState({
    onInviteStudents,
    showAction = true,
    size = "md",
    className,
}: EmptyStudentsStateProps) {
    return (
        <EmptyState
            icon={Users}
            title="No students enrolled"
            description="Share your course code or invite students to join and start learning together."
            action={
                showAction && onInviteStudents
                    ? {
                          label: "Invite Students",
                          onClick: onInviteStudents,
                          icon: Plus,
                      }
                    : undefined
            }
            size={size}
            className={className}
        />
    );
}

// ============================================
// EmptySessionsState Component
// ============================================

interface EmptySessionsStateProps {
    /**
     * Callback when "Start Session" button is clicked
     */
    onStartSession?: () => void;
    /**
     * Whether to show the start action button
     * @default true
     */
    showAction?: boolean;
    /**
     * Size variant
     * @default "md"
     */
    size?: "sm" | "md" | "lg";
    className?: string;
}

/**
 * Empty state for game sessions when no sessions have been played.
 */
export function EmptySessionsState({
    onStartSession,
    showAction = true,
    size = "md",
    className,
}: EmptySessionsStateProps) {
    return (
        <EmptyState
            icon={Trophy}
            title="No game sessions yet"
            description="Start a live game session to engage students with real-time quizzes and leaderboards."
            action={
                showAction && onStartSession
                    ? {
                          label: "Start Session",
                          onClick: onStartSession,
                          icon: Plus,
                      }
                    : undefined
            }
            size={size}
            className={className}
        />
    );
}

// ============================================
// EmptySearchState Component
// ============================================

interface EmptySearchStateProps {
    /**
     * The search query that returned no results
     */
    query: string;
    /**
     * Callback when "Clear Search" button is clicked
     */
    onClearSearch?: () => void;
    /**
     * Size variant
     * @default "md"
     */
    size?: "sm" | "md" | "lg";
    className?: string;
}

/**
 * Empty state for search results when no matches are found.
 */
export function EmptySearchState({
    query,
    onClearSearch,
    size = "md",
    className,
}: EmptySearchStateProps) {
    return (
        <EmptyState
            icon={Search}
            title="No results found"
            description={`We couldn't find anything matching "${query}". Try adjusting your search terms or filters.`}
            action={
                onClearSearch
                    ? {
                          label: "Clear Search",
                          onClick: onClearSearch,
                      }
                    : undefined
            }
            size={size}
            className={className}
        />
    );
}

// ============================================
// EmptyInboxState Component
// ============================================

interface EmptyInboxStateProps {
    /**
     * Size variant
     * @default "md"
     */
    size?: "sm" | "md" | "lg";
    className?: string;
}

/**
 * Empty state for inbox/notifications when there are no messages.
 */
export function EmptyInboxState({ size = "md", className }: EmptyInboxStateProps) {
    return (
        <EmptyState
            icon={Inbox}
            title="Your inbox is empty"
            description="You're all caught up! New notifications and messages will appear here."
            size={size}
            className={className}
        />
    );
}
