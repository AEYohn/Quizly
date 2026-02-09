"use client";

import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";

interface BottomSheetProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    tall?: boolean;
    children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, tall, children }: BottomSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const currentY = useRef(0);

    // Close on escape
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    // Swipe-to-dismiss
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        startY.current = e.touches[0]?.clientY ?? 0;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        currentY.current = (e.touches[0]?.clientY ?? 0) - startY.current;
        if (currentY.current > 0 && sheetRef.current) {
            sheetRef.current.style.transform = `translateY(${currentY.current}px)`;
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (currentY.current > 100) {
            onClose();
        }
        if (sheetRef.current) {
            sheetRef.current.style.transform = "";
        }
        currentY.current = 0;
    }, [onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Sheet */}
            <div
                ref={sheetRef}
                className={cn(
                    "relative bg-gray-950 rounded-t-3xl border-t border-gray-800/60 max-h-[85vh] flex flex-col",
                    tall && "h-[85vh]",
                    "transition-transform duration-200 ease-out",
                )}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-gray-700" />
                </div>

                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/40 shrink-0">
                        <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 pb-[env(safe-area-inset-bottom)]">
                    {children}
                </div>
            </div>
        </div>
    );
}
