"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
    Play,
    CheckCircle,
    XCircle,
    Loader2,
    RotateCcw,
    ChevronDown,
    ChevronUp,
    Terminal,
    FileCode,
    Lightbulb,
} from "lucide-react";
import { codeApi, type CodeExecutionResult, type TestCaseInput } from "~/lib/api";

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
    ),
});

interface CodeEditorProps {
    questionId?: string;
    prompt: string;
    starterCode: string;
    testCases: TestCaseInput[];
    language?: string;
    onSubmit?: (result: CodeExecutionResult) => void;
    onCodeChange?: (code: string) => void;
    readOnly?: boolean;
}

// Map our language names to Monaco language IDs
const getMonacoLanguage = (lang: string) => {
    const map: Record<string, string> = {
        python: "python",
        javascript: "javascript",
        cpp: "cpp",
        "c++": "cpp",
        java: "java",
        typescript: "typescript",
    };
    return map[lang.toLowerCase()] || "plaintext";
};

// Map language names to API-compatible language IDs
const getApiLanguage = (lang: string) => {
    const map: Record<string, string> = {
        python: "python",
        javascript: "javascript",
        cpp: "cpp",
        "c++": "cpp",  // Convert c++ to cpp for API
        java: "java",
        typescript: "javascript",
    };
    return map[lang.toLowerCase()] || lang.toLowerCase();
};

export default function CodeEditor({
    questionId,
    prompt,
    starterCode,
    testCases,
    language = "python",
    onSubmit,
    onCodeChange,
    readOnly = false,
}: CodeEditorProps) {
    const [code, setCode] = useState(starterCode);
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<CodeExecutionResult | null>(null);
    const [activeTab, setActiveTab] = useState<"description" | "testcases">("description");
    const [consoleOpen, setConsoleOpen] = useState(true);

    // Reset code when starter code changes
    useEffect(() => {
        setCode(starterCode);
        setResult(null);
    }, [starterCode]);
    
    // Notify parent of code changes
    const handleCodeChange = (newCode: string) => {
        setCode(newCode);
        onCodeChange?.(newCode);
    };

    const handleRun = async () => {
        setIsRunning(true);
        setConsoleOpen(true);

        try {
            const apiLang = getApiLanguage(language);
            // Use batch API for better performance when there are multiple test cases
            const res = testCases.length > 1
                ? await codeApi.runCodeBatch(code, apiLang, testCases)
                : await codeApi.runCode(code, apiLang, testCases);

            if (res.success) {
                setResult(res.data);
                onSubmit?.(res.data);
            } else {
                setResult({
                    status: "error",
                    passed_count: 0,
                    total_count: testCases.length,
                    test_results: [],
                    overall_time_ms: 0,
                    error_message: res.error || "Failed to execute code. Please check your code and try again.",
                    all_passed: false,
                    score_percent: 0,
                });
            }
        } catch (error) {
            setResult({
                status: "error",
                passed_count: 0,
                total_count: testCases.length,
                test_results: [],
                overall_time_ms: 0,
                error_message: error instanceof Error ? error.message : "Network error. Please check your connection.",
                all_passed: false,
                score_percent: 0,
            });
        } finally {
            setIsRunning(false);
        }
    };

    const handleReset = () => {
        setCode(starterCode);
        setResult(null);
    };

    const getLanguageIcon = (lang: string) => {
        switch (lang.toLowerCase()) {
            case "python": return "🐍";
            case "javascript": return "🟨";
            case "cpp":
            case "c++": return "⚡";
            case "java": return "☕";
            default: return "📄";
        }
    };

    const getLanguageLabel = (lang: string) => {
        switch (lang.toLowerCase()) {
            case "python": return "Python 3";
            case "javascript": return "JavaScript";
            case "cpp":
            case "c++": return "C++ 17";
            case "java": return "Java 17";
            default: return lang;
        }
    };

    const visibleTestCases = testCases.filter(t => !t.is_hidden);
    const hiddenCount = testCases.filter(t => t.is_hidden).length;

    return (
        <div className="flex h-full bg-[#1a1a2e] rounded-xl overflow-hidden border border-gray-700/50 shadow-2xl">
            {/* Left Panel - Problem Description */}
            <div className="w-[45%] flex flex-col border-r border-gray-700/50">
                {/* Tabs */}
                <div className="flex items-center gap-1 px-2 py-2 bg-[#0f0f1a] border-b border-gray-700/50">
                    <button
                        onClick={() => setActiveTab("description")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                            activeTab === "description"
                                ? "bg-[#2d2d4a] text-white"
                                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                        }`}
                    >
                        <FileCode className="h-4 w-4" />
                        Description
                    </button>
                    <button
                        onClick={() => setActiveTab("testcases")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                            activeTab === "testcases"
                                ? "bg-[#2d2d4a] text-white"
                                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                        }`}
                    >
                        <Terminal className="h-4 w-4" />
                        Test Cases
                        <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-gray-700">{visibleTestCases.length}</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === "description" && (
                        <div className="p-5">
                            <div className="prose prose-invert prose-sm max-w-none">
                                <div className="text-gray-200 leading-relaxed whitespace-pre-wrap text-[15px]">
                                    {prompt}
                                </div>
                            </div>
                            
                            {visibleTestCases.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                                        <Lightbulb className="h-4 w-4 text-yellow-400" />
                                        Examples
                                    </h3>
                                    {visibleTestCases.slice(0, 2).map((tc, i) => (
                                        <div key={i} className="mb-4 rounded-lg bg-[#0f0f1a] p-4 border border-gray-700/30">
                                            <div className="mb-2">
                                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Input</span>
                                                <pre className="mt-1 text-sm text-cyan-400 font-mono bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{tc.input}</pre>
                                            </div>
                                            <div>
                                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Output</span>
                                                <pre className="mt-1 text-sm text-emerald-400 font-mono bg-black/30 p-2 rounded whitespace-pre-wrap break-all">{tc.expected_output}</pre>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "testcases" && (
                        <div className="p-4 space-y-3">
                            {visibleTestCases.map((tc, i) => (
                                <div key={i} className="rounded-lg bg-[#0f0f1a] p-4 border border-gray-700/30">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-gray-300">Case {i + 1}</span>
                                        {result?.test_results[i] && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                result.test_results[i].status === "passed"
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-red-500/20 text-red-400"
                                            }`}>
                                                {result.test_results[i].status === "passed" ? "Passed" : "Failed"}
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-xs text-gray-500">Input:</span>
                                            <pre className="mt-1 text-sm text-cyan-400 font-mono bg-black/30 p-2 rounded whitespace-pre-wrap break-all">{tc.input}</pre>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500">Expected:</span>
                                            <pre className="mt-1 text-sm text-emerald-400 font-mono bg-black/30 p-2 rounded whitespace-pre-wrap break-all">{tc.expected_output}</pre>
                                        </div>
                                        {result?.test_results[i]?.actual_output && (
                                            <div>
                                                <span className="text-xs text-gray-500">Your Output:</span>
                                                <pre className={`mt-1 text-sm font-mono bg-black/30 p-2 rounded whitespace-pre-wrap break-all ${
                                                    result.test_results[i].status === "passed" ? "text-emerald-400" : "text-red-400"
                                                }`}>{result.test_results[i].actual_output}</pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {hiddenCount > 0 && (
                                <div className="text-center text-sm text-gray-500 py-2">
                                    🔒 {hiddenCount} hidden test case{hiddenCount > 1 ? 's' : ''}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Code Editor */}
            <div className="flex-1 flex flex-col">
                {/* Editor Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-[#0f0f1a] border-b border-gray-700/50">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{getLanguageIcon(language)}</span>
                        <span className="text-sm font-medium text-gray-300">{getLanguageLabel(language)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-md transition-all"
                            disabled={readOnly}
                        >
                            <RotateCcw className="h-4 w-4" />
                            Reset
                        </button>
                        <button
                            onClick={handleRun}
                            disabled={isRunning || readOnly}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:hover:bg-emerald-600"
                        >
                            {isRunning ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Running...
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4" />
                                    Run Code
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Monaco Editor */}
                <div className="flex-1 min-h-0">
                    <MonacoEditor
                        height="100%"
                        language={getMonacoLanguage(language)}
                        value={code}
                        onChange={(value) => handleCodeChange(value || "")}
                        theme="vs-dark"
                        options={{
                            fontSize: 14,
                            fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
                            fontLigatures: true,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            lineNumbers: "on",
                            glyphMargin: false,
                            folding: true,
                            lineDecorationsWidth: 10,
                            lineNumbersMinChars: 3,
                            renderLineHighlight: "line",
                            scrollbar: {
                                verticalScrollbarSize: 8,
                                horizontalScrollbarSize: 8,
                            },
                            padding: { top: 16, bottom: 16 },
                            wordWrap: "on",
                            automaticLayout: true,
                            tabSize: 4,
                            readOnly: readOnly,
                        }}
                    />
                </div>

                {/* Console/Results Panel */}
                <div className="border-t border-gray-700/50">
                    <button
                        onClick={() => setConsoleOpen(!consoleOpen)}
                        className="w-full flex items-center justify-between px-4 py-2 bg-[#0f0f1a] hover:bg-[#1a1a2e] transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-300">Console</span>
                            {result && (
                                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                                    result.all_passed
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-red-500/20 text-red-400"
                                }`}>
                                    {result.passed_count}/{result.total_count} passed
                                </span>
                            )}
                        </div>
                        {consoleOpen ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                        )}
                    </button>

                    {consoleOpen && (
                        <div className="max-h-[200px] overflow-y-auto bg-[#0a0a14] p-4">
                            {!result && !isRunning && (
                                <div className="text-center text-gray-500 py-4">
                                    <Play className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Run your code to see output</p>
                                </div>
                            )}

                            {isRunning && (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm">Executing...</span>
                                </div>
                            )}

                            {result && (
                                <div className="space-y-3">
                                    {/* Status Banner */}
                                    <div className={`flex items-center gap-3 p-3 rounded-lg ${
                                        result.all_passed
                                            ? "bg-green-500/10 border border-green-500/30"
                                            : result.status === "compilation_error"
                                            ? "bg-orange-500/10 border border-orange-500/30"
                                            : "bg-red-500/10 border border-red-500/30"
                                    }`}>
                                        {result.all_passed ? (
                                            <CheckCircle className="h-5 w-5 text-green-400" />
                                        ) : (
                                            <XCircle className={`h-5 w-5 ${result.status === "compilation_error" ? "text-orange-400" : "text-red-400"}`} />
                                        )}
                                        <div>
                                            <div className={`font-medium ${
                                                result.all_passed
                                                    ? "text-green-400"
                                                    : result.status === "compilation_error"
                                                    ? "text-orange-400"
                                                    : "text-red-400"
                                            }`}>
                                                {result.all_passed
                                                    ? "All test cases passed!"
                                                    : result.status === "compilation_error"
                                                    ? "Compilation Error"
                                                    : result.status === "runtime_error"
                                                    ? "Runtime Error"
                                                    : result.status === "timeout"
                                                    ? "Time Limit Exceeded"
                                                    : result.status === "error"
                                                    ? "Execution Error"
                                                    : `${result.passed_count} of ${result.total_count} test cases passed`}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Runtime: {result.overall_time_ms.toFixed(0)}ms
                                                {result.test_results[0]?.memory_kb && ` • Memory: ${(result.test_results[0].memory_kb / 1024).toFixed(1)}MB`}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Error Message */}
                                    {result.error_message && (
                                        <pre className="text-sm text-red-400 bg-black/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                                            {result.error_message}
                                        </pre>
                                    )}

                                    {/* Test Results Summary */}
                                    {result.test_results.length > 0 && (
                                        <div className="space-y-2">
                                            {result.test_results.map((tr, i) => (
                                                <div key={i} className="border border-gray-700/50 rounded-lg overflow-hidden">
                                                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/30">
                                                        {tr.status === "passed" ? (
                                                            <CheckCircle className="h-4 w-4 text-green-400" />
                                                        ) : (
                                                            <XCircle className="h-4 w-4 text-red-400" />
                                                        )}
                                                        <span className={tr.status === "passed" ? "text-green-400" : "text-red-400"}>
                                                            Test {i + 1}: {tr.status === "passed" ? "Passed" : "Failed"}
                                                        </span>
                                                        <span className="text-gray-600 text-xs">
                                                            ({tr.execution_time_ms?.toFixed(0) || 0}ms)
                                                        </span>
                                                    </div>
                                                    {/* Always show details for failed tests */}
                                                    {tr.status !== "passed" && (
                                                        <div className="px-3 py-2 space-y-2 text-xs font-mono bg-black/20">
                                                            <div>
                                                                <span className="text-gray-500">Input: </span>
                                                                <span className="text-cyan-400">{tr.input || "(none)"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">Expected: </span>
                                                                <span className="text-emerald-400">{tr.expected_output || "(none)"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">Your output: </span>
                                                                <span className="text-red-400">{tr.actual_output || "(no output)"}</span>
                                                            </div>
                                                            {tr.error_message && (
                                                                <div className="mt-1 p-2 bg-red-500/10 rounded border border-red-500/30">
                                                                    <span className="text-orange-400 whitespace-pre-wrap">{tr.error_message}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
