"use client";

import {
    type ReactNode,
    type KeyboardEvent,
    useRef,
    useEffect,
    useCallback,
} from "react";
import { cn } from "@/lib/utils";

// ============================================
// FocusTrap Component
// ============================================

/**
 * Selector for all focusable elements within the trap
 */
const FOCUSABLE_SELECTOR = [
    "button:not([disabled])",
    "[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(", ");

interface FocusTrapProps {
    /**
     * Content to render inside the focus trap
     */
    children: ReactNode;
    /**
     * Whether the focus trap is active
     * @default true
     */
    active?: boolean;
    /**
     * Whether to focus the first focusable element on mount
     * @default true
     */
    autoFocus?: boolean;
    /**
     * Whether to restore focus to the previously focused element on unmount
     * @default true
     */
    restoreFocus?: boolean;
    /**
     * Additional class names for the container
     */
    className?: string;
    /**
     * Accessible label for the dialog
     */
    "aria-label"?: string;
    /**
     * ID of element that labels the dialog
     */
    "aria-labelledby"?: string;
    /**
     * ID of element that describes the dialog
     */
    "aria-describedby"?: string;
}

/**
 * FocusTrap component traps keyboard focus within its children.
 * Useful for modals, dialogs, and other overlay components that
 * need to keep focus contained for accessibility.
 *
 * Features:
 * - Tab cycles through focusable elements
 * - Shift+Tab cycles backwards
 * - Focus first element on mount (optional)
 * - Restore focus on unmount (optional)
 * - Uses role="dialog" and aria-modal="true" for screen readers
 *
 * @example
 * <FocusTrap active={isModalOpen} aria-label="Confirmation dialog">
 *   <h2>Are you sure?</h2>
 *   <button onClick={onCancel}>Cancel</button>
 *   <button onClick={onConfirm}>Confirm</button>
 * </FocusTrap>
 */
export function FocusTrap({
    children,
    active = true,
    autoFocus = true,
    restoreFocus = true,
    className,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
}: FocusTrapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);

    /**
     * Get all focusable elements within the container
     */
    const getFocusableElements = useCallback((): HTMLElement[] => {
        if (!containerRef.current) return [];
        return Array.from(
            containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
    }, []);

    /**
     * Focus the first focusable element in the trap
     */
    const focusFirstElement = useCallback(() => {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    }, [getFocusableElements]);

    /**
     * Handle keyboard navigation within the trap
     */
    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (!active || event.key !== "Tab") return;

            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            const activeElement = document.activeElement as HTMLElement;

            // Shift + Tab: go to previous element, wrap to last if at first
            if (event.shiftKey) {
                if (activeElement === firstElement || !containerRef.current?.contains(activeElement)) {
                    event.preventDefault();
                    lastElement.focus();
                }
            }
            // Tab: go to next element, wrap to first if at last
            else {
                if (activeElement === lastElement || !containerRef.current?.contains(activeElement)) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        },
        [active, getFocusableElements]
    );

    // Store the previously focused element and focus the first element on mount
    useEffect(() => {
        if (!active) return;

        // Store the currently focused element to restore later
        if (restoreFocus) {
            previouslyFocusedRef.current = document.activeElement as HTMLElement;
        }

        // Focus the first focusable element
        if (autoFocus) {
            // Use requestAnimationFrame to ensure the DOM is ready
            const rafId = requestAnimationFrame(() => {
                focusFirstElement();
            });

            return () => {
                cancelAnimationFrame(rafId);
            };
        }
    }, [active, autoFocus, restoreFocus, focusFirstElement]);

    // Restore focus when the trap is deactivated or unmounted
    useEffect(() => {
        return () => {
            if (restoreFocus && previouslyFocusedRef.current) {
                // Use requestAnimationFrame to handle the focus restoration
                // after the component is fully unmounted
                requestAnimationFrame(() => {
                    previouslyFocusedRef.current?.focus();
                });
            }
        };
    }, [restoreFocus]);

    // If not active, just render children without the trap
    if (!active) {
        return <>{children}</>;
    }

    return (
        <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            onKeyDown={handleKeyDown}
            className={cn("outline-none", className)}
            tabIndex={-1}
        >
            {children}
        </div>
    );
}

// ============================================
// Exports
// ============================================

export default FocusTrap;
