"use client";

import { useState, useEffect } from "react";
import { codeApi, type CodeHealthCheck } from "~/lib/api";
import { CheckCircle, XCircle, Loader2, Zap } from "lucide-react";

interface CodeExecutionStatusProps {
    className?: string;
    showDetails?: boolean;
}

export function CodeExecutionStatus({ className = "", showDetails = false }: CodeExecutionStatusProps) {
    const [health, setHealth] = useState<CodeHealthCheck | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkHealth();
    }, []);

    async function checkHealth() {
        setLoading(true);
        try {
            const res = await codeApi.healthCheck();
            if (res.success) {
                setHealth(res.data);
            } else {
                setHealth({
                    status: "unhealthy",
                    execution_engine: "local",
                    warning: res.error,
                });
            }
        } catch (err) {
            setHealth({
                status: "unhealthy",
                execution_engine: "local",
                warning: err instanceof Error ? err.message : "Failed to check health",
            });
        }
        setLoading(false);
    }

    if (loading) {
        return (
            <div className={`flex items-center gap-2 text-gray-400 ${className}`}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Checking code runner...</span>
            </div>
        );
    }

    if (!health) return null;

    const isHealthy = health.status === "healthy";
    const isJudge0 = health.execution_engine === "judge0";

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {isHealthy ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
                <XCircle className="h-4 w-4 text-red-500" />
            )}
            <div className="flex items-center gap-1">
                <span className={`text-xs ${isHealthy ? "text-green-400" : "text-red-400"}`}>
                    {isJudge0 ? "Judge0" : "Local"}
                </span>
                {isJudge0 && (
                    <span title="Sandboxed execution">
                        <Zap className="h-3 w-3 text-yellow-500" />
                    </span>
                )}
            </div>
            {showDetails && health.warning && (
                <span className="text-xs text-orange-400 ml-2">{health.warning}</span>
            )}
        </div>
    );
}

export default CodeExecutionStatus;
