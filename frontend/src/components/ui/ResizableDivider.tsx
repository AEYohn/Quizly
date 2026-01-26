"use client";

import { useCallback, useEffect, useState, useRef } from "react";

interface ResizableDividerProps {
    direction: "horizontal" | "vertical";
    onResize: (delta: number) => void;
    className?: string;
}

export function ResizableDivider({ direction, onResize, className = "" }: ResizableDividerProps) {
    const [isDragging, setIsDragging] = useState(false);
    const lastPos = useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        lastPos.current = direction === "horizontal" ? e.clientX : e.clientY;
    }, [direction]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
            const delta = currentPos - lastPos.current;
            lastPos.current = currentPos;
            onResize(delta);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, direction, onResize]);

    if (direction === "horizontal") {
        return (
            <div
                className={`relative w-2 flex-shrink-0 cursor-col-resize group ${className}`}
                onMouseDown={handleMouseDown}
                style={{ touchAction: 'none' }}
            >
                {/* Visible divider line */}
                <div className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors ${
                    isDragging ? "bg-sky-500" : "bg-gray-600 group-hover:bg-sky-500"
                }`} />
            </div>
        );
    }

    return (
        <div
            className={`relative h-2 flex-shrink-0 cursor-row-resize group ${className}`}
            onMouseDown={handleMouseDown}
            style={{ touchAction: 'none' }}
        >
            {/* Visible divider line */}
            <div className={`absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 transition-colors ${
                isDragging ? "bg-sky-500" : "bg-gray-600 group-hover:bg-sky-500"
            }`} />
        </div>
    );
}
