"use client";

import { type ReactNode, forwardRef } from "react";
import { clsx } from "clsx";

// ============================================
// Button Component
// ============================================

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
}

const buttonVariants: Record<ButtonVariant, string> = {
    primary:
        "bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-600/25 hover:shadow-xl hover:shadow-teal-600/30",
    secondary:
        "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline:
        "border-2 border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
    ghost:
        "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
    danger:
        "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/25",
};

const buttonSizes: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = "primary",
            size = "md",
            isLoading,
            leftIcon,
            rightIcon,
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        return (
            <button
                ref={ref}
                className={clsx(
                    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                    buttonVariants[variant],
                    buttonSizes[size],
                    className
                )}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <svg
                        className="h-5 w-5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                ) : (
                    leftIcon
                )}
                {children}
                {!isLoading && rightIcon}
            </button>
        );
    }
);

Button.displayName = "Button";

// ============================================
// Card Component
// ============================================

interface CardProps {
    className?: string;
    children: ReactNode;
    hover?: boolean;
    padding?: "none" | "sm" | "md" | "lg";
}

const cardPadding = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
};

export function Card({ className, children, hover = false, padding = "md" }: CardProps) {
    return (
        <div
            className={clsx(
                "rounded-2xl border border-gray-100 bg-white shadow-sm",
                hover && "transition-shadow hover:shadow-md",
                cardPadding[padding],
                className
            )}
        >
            {children}
        </div>
    );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div className={clsx("mb-4", className)}>
            {children}
        </div>
    );
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <h3 className={clsx("text-lg font-semibold text-gray-900", className)}>
            {children}
        </h3>
    );
}

export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <p className={clsx("mt-1 text-sm text-gray-500", className)}>
            {children}
        </p>
    );
}

// ============================================
// Badge Component
// ============================================

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "teal";

interface BadgeProps {
    variant?: BadgeVariant;
    children: ReactNode;
    className?: string;
    dot?: boolean;
    pulse?: boolean;
}

const badgeVariants: Record<BadgeVariant, string> = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-sky-100 text-sky-700",
    teal: "bg-teal-100 text-teal-700",
};

const dotVariants: Record<BadgeVariant, string> = {
    default: "bg-gray-500",
    success: "bg-green-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-sky-500",
    teal: "bg-teal-500",
};

export function Badge({ variant = "default", children, className, dot, pulse }: BadgeProps) {
    return (
        <span
            className={clsx(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                badgeVariants[variant],
                className
            )}
        >
            {dot && (
                <span className="relative flex h-2 w-2">
                    {pulse && (
                        <span
                            className={clsx(
                                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                                dotVariants[variant]
                            )}
                        />
                    )}
                    <span
                        className={clsx(
                            "relative inline-flex h-2 w-2 rounded-full",
                            dotVariants[variant]
                        )}
                    />
                </span>
            )}
            {children}
        </span>
    );
}

// ============================================
// Progress Bar Component
// ============================================

interface ProgressProps {
    value: number;
    max?: number;
    color?: "default" | "success" | "warning" | "danger" | "info" | "teal";
    showLabel?: boolean;
    showValue?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
    animated?: boolean;
}

const progressColors = {
    default: "bg-gray-600",
    success: "bg-green-600",
    warning: "bg-amber-500",
    danger: "bg-red-600",
    info: "bg-sky-600",
    teal: "bg-teal-600",
};

const progressSizes = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
};

export function Progress({
    value,
    max = 100,
    color = "default",
    showLabel = false,
    showValue = false,
    size = "md",
    className,
    animated = false,
}: ProgressProps) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
        <div className={clsx("w-full", className)}>
            {showValue && (
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{Math.round(value)}</span>
                    <span>{Math.round(percentage)}%</span>
                </div>
            )}
            <div
                className={clsx(
                    "w-full overflow-hidden rounded-full bg-gray-200",
                    progressSizes[size]
                )}
            >
                <div
                    className={clsx(
                        "rounded-full transition-all duration-500 ease-out",
                        progressColors[color],
                        progressSizes[size],
                        animated && "animate-pulse"
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {showLabel && (
                <div className="mt-1 text-right text-xs text-gray-500">
                    {Math.round(percentage)}%
                </div>
            )}
        </div>
    );
}

// ============================================
// Alert Component
// ============================================

type AlertVariant = "info" | "success" | "warning" | "danger";

interface AlertProps {
    variant?: AlertVariant;
    title?: string;
    children: ReactNode;
    icon?: ReactNode;
    className?: string;
    onClose?: () => void;
}

const alertVariants: Record<AlertVariant, { bg: string; border: string; text: string }> = {
    info: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800" },
    success: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800" },
    warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
    danger: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
};

export function Alert({ variant = "info", title, children, icon, className, onClose }: AlertProps) {
    const styles = alertVariants[variant];

    return (
        <div
            className={clsx(
                "relative rounded-xl border p-4",
                styles.bg,
                styles.border,
                className
            )}
        >
            <div className="flex gap-3">
                {icon && <div className={styles.text}>{icon}</div>}
                <div className="flex-1">
                    {title && (
                        <h5 className={clsx("font-semibold", styles.text)}>{title}</h5>
                    )}
                    <div className={clsx("text-sm", styles.text, title && "mt-1")}>
                        {children}
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className={clsx("p-1 hover:opacity-70", styles.text)}
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}

// ============================================
// Skeleton Component
// ============================================

interface SkeletonProps {
    className?: string;
    variant?: "text" | "circular" | "rectangular";
    width?: string | number;
    height?: string | number;
}

export function Skeleton({ className, variant = "text", width, height }: SkeletonProps) {
    return (
        <div
            className={clsx(
                "animate-pulse bg-gray-200",
                variant === "circular" && "rounded-full",
                variant === "rectangular" && "rounded-lg",
                variant === "text" && "rounded h-4",
                className
            )}
            style={{ width, height }}
        />
    );
}

// ============================================
// Stat Card Component
// ============================================

interface StatCardProps {
    icon?: ReactNode;
    label: string;
    value: string | number;
    change?: { value: number; label?: string };
    color?: "default" | "success" | "warning" | "danger" | "info" | "teal";
    className?: string;
}

const statColors = {
    default: "text-gray-600 bg-gray-100",
    success: "text-green-600 bg-green-100",
    warning: "text-amber-600 bg-amber-100",
    danger: "text-red-600 bg-red-100",
    info: "text-sky-600 bg-sky-100",
    teal: "text-teal-600 bg-teal-100",
};

export function StatCard({ icon, label, value, change, color = "default", className }: StatCardProps) {
    return (
        <Card className={className} padding="md">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
                    {change && (
                        <p
                            className={clsx(
                                "mt-1 text-xs font-medium",
                                change.value >= 0 ? "text-green-600" : "text-red-600"
                            )}
                        >
                            {change.value >= 0 ? "↑" : "↓"} {Math.abs(change.value)}%
                            {change.label && <span className="text-gray-400"> {change.label}</span>}
                        </p>
                    )}
                </div>
                {icon && (
                    <div className={clsx("rounded-lg p-2", statColors[color])}>
                        {icon}
                    </div>
                )}
            </div>
        </Card>
    );
}

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={clsx("flex flex-col items-center justify-center py-12 text-center", className)}>
            {icon && (
                <div className="mb-4 rounded-full bg-gray-100 p-4 text-gray-400">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
