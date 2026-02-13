"use client";

import { type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ============================================
// VisuallyHidden Component
// ============================================

interface VisuallyHiddenProps extends HTMLAttributes<HTMLSpanElement> {
    /**
     * Content to be hidden visually but accessible to screen readers
     */
    children: ReactNode;
    /**
     * Additional class names
     */
    className?: string;
}

/**
 * VisuallyHidden component hides content visually while keeping it
 * accessible to screen readers. Useful for providing context to
 * assistive technologies without affecting visual layout.
 *
 * @example
 * <button>
 *   <TrashIcon />
 *   <VisuallyHidden>Delete item</VisuallyHidden>
 * </button>
 */
export function VisuallyHidden({ children, className, ...props }: VisuallyHiddenProps) {
    return (
        <span
            className={cn(
                // Standard visually hidden styles
                // Position absolute to remove from document flow
                "absolute",
                // Clip to a 1x1 pixel area
                "w-px h-px",
                // Prevent overflow
                "overflow-hidden",
                // Use clip for older browsers and clip-path for modern browsers
                "[clip:rect(0,0,0,0)]",
                "clip-path-[inset(50%)]",
                // Remove whitespace handling
                "whitespace-nowrap",
                // Remove borders and padding
                "border-0 p-0 m-[-1px]",
                className
            )}
            {...props}
        >
            {children}
        </span>
    );
}

// ============================================
// SkipLink Component
// ============================================

interface SkipLinkProps {
    /**
     * Target element ID to skip to (without the # prefix)
     * @default "main-content"
     */
    targetId?: string;
    /**
     * Text to display in the skip link
     * @default "Skip to main content"
     */
    children?: ReactNode;
    /**
     * Additional class names
     */
    className?: string;
}

/**
 * SkipLink component provides keyboard users a way to skip repetitive
 * navigation and jump directly to main content. The link is visually
 * hidden until focused.
 *
 * @example
 * // In your layout component, before the navigation:
 * <SkipLink targetId="main-content" />
 * <Navigation />
 * <main id="main-content">...</main>
 */
export function SkipLink({
    targetId = "main-content",
    children = "Skip to main content",
    className,
}: SkipLinkProps) {
    return (
        <a
            href={`#${targetId}`}
            className={cn(
                // Visually hidden by default (sr-only equivalent)
                "sr-only",
                // Become visible on focus
                "focus:not-sr-only",
                "focus:fixed focus:top-4 focus:left-4 focus:z-[9999]",
                // Styling when visible
                "focus:px-4 focus:py-2",
                "focus:bg-teal-600 focus:text-white",
                "focus:rounded-lg focus:shadow-lg",
                "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2",
                "focus:font-medium",
                // Transition for smooth appearance
                "transition-all duration-150",
                className
            )}
        >
            {children}
        </a>
    );
}

// ============================================
// Exports
// ============================================

export default VisuallyHidden;
