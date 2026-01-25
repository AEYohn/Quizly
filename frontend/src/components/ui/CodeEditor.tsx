"use client";

import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Play, RotateCcw, Check, X, Loader2, ChevronDown, Clock, Zap } from "lucide-react";
import { codeApi, type TestCaseInput, type CodeExecutionResult } from "~/lib/api";

interface TestCase {
    id: number;
    input: string;
    expected_output: string;
    is_hidden?: boolean;
}

interface CodeEditorProps {
    problemId?: number;
    initialCode?: string;
    language?: string;
    testCases?: TestCase[];
    onSubmit?: (code: string, language: string) => void;
    onRunComplete?: (result: CodeExecutionResult) => void;
    readOnly?: boolean;
}

const LANGUAGES = [
    { id: "python", name: "Python", template: "# Write your solution here\n\ndef solution():\n    pass\n" },
    { id: "javascript", name: "JavaScript", template: "// Write your solution here\n\nfunction solution() {\n    \n}\n" },
    { id: "java", name: "Java", template: "// Write your solution here\n\npublic class Solution {\n    public static void main(String[] args) {\n        \n    }\n}\n" },
    { id: "cpp", name: "C++", template: "// Write your solution here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n" },
    { id: "sql", name: "SQL", template: "-- Write your query here\nSELECT * FROM table_name;\n" },
];

const THEMES = [
    { id: "vs-dark", name: "Dark" },
    { id: "light", name: "Light" },
];

export function CodeEditor({
    problemId,
    initialCode,
    language: initialLanguage = "python",
    testCases = [],
    onSubmit,
    onRunComplete,
    readOnly = false,
}: CodeEditorProps) {
    const [code, setCode] = useState(initialCode || LANGUAGES.find(l => l.id === initialLanguage)?.template || "");
    const [language, setLanguage] = useState(initialLanguage);
    const [theme, setTheme] = useState("vs-dark");
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<{ passed: boolean; output: string; expected?: string; input?: string; error?: string; time_ms?: number; status?: string }[]>([]);
    const [activeTab, setActiveTab] = useState<"testcases" | "results">("testcases");
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const [executionStats, setExecutionStats] = useState<{ time_ms: number; memory_kb?: number } | null>(null);

    // Update code when initialCode changes (e.g., language switch)
    useEffect(() => {
        if (initialCode) {
            setCode(initialCode);
        }
    }, [initialCode]);

    const handleLanguageChange = (newLang: string) => {
        setLanguage(newLang);
        const template = LANGUAGES.find(l => l.id === newLang)?.template || "";
        if (!code || code === LANGUAGES.find(l => l.id === language)?.template) {
            setCode(template);
        }
        setShowLanguageDropdown(false);
    };

    const handleRun = async () => {
        setIsRunning(true);
        setActiveTab("results");
        setExecutionStats(null);

        // Convert test cases to API format
        const apiTestCases: TestCaseInput[] = testCases
            .filter(tc => !tc.is_hidden)
            .map(tc => ({
                input: tc.input,
                expected_output: tc.expected_output,
                is_hidden: tc.is_hidden,
            }));

        if (apiTestCases.length === 0) {
            // No test cases to run
            setResults([{
                passed: false,
                output: "No test cases available to run",
                expected: "",
            }]);
            setIsRunning(false);
            return;
        }

        try {
            // Use batch API for multiple test cases, regular API for single
            const res = apiTestCases.length > 1
                ? await codeApi.runCodeBatch(code, language, apiTestCases)
                : await codeApi.runCode(code, language, apiTestCases);

            if (res.success && res.data) {
                const data = res.data;

                // Store execution stats
                setExecutionStats({
                    time_ms: data.overall_time_ms,
                    memory_kb: data.test_results[0]?.memory_kb,
                });

                // Map results to frontend format
                const mappedResults = data.test_results.map((tr, i) => ({
                    passed: tr.status === "passed",
                    output: tr.actual_output || (tr.error_message ? `Error: ${tr.error_message}` : "No output"),
                    expected: tr.expected_output || testCases[i]?.expected_output,
                    input: tr.input || testCases[i]?.input,
                    error: tr.error_message,
                    time_ms: tr.execution_time_ms,
                    status: tr.status,
                }));
                setResults(mappedResults);

                // Callback for parent component
                onRunComplete?.(data);
            } else {
                const errorMsg = 'error' in res ? res.error : "Failed to execute code";
                setResults([{
                    passed: false,
                    output: errorMsg || "Failed to execute code",
                    expected: "Successful execution",
                    error: errorMsg,
                }]);
            }
        } catch (err) {
            console.error("Error running code:", err);
            setResults([{
                passed: false,
                output: `Network error: ${err instanceof Error ? err.message : String(err)}`,
                expected: "Successful execution",
                error: err instanceof Error ? err.message : String(err),
            }]);
        }

        setIsRunning(false);
    };

    const handleSubmit = () => {
        if (onSubmit) {
            onSubmit(code, language);
        }
    };

    const handleReset = () => {
        const template = LANGUAGES.find(l => l.id === language)?.template || "";
        setCode(template);
        setResults([]);
    };

    const passedCount = results.filter(r => r.passed).length;
    const totalVisible = testCases.filter(tc => !tc.is_hidden).length;

    // Helper to convert escaped newlines to actual newlines for display
    const formatForDisplay = (text: string | undefined): string => {
        if (!text) return "(none)";
        // Replace literal \n with actual newlines
        return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    };

    return (
        <div className="flex h-full flex-col rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-2">
                <div className="flex items-center gap-3">
                    {/* Language Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                            className="flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-600"
                        >
                            {LANGUAGES.find(l => l.id === language)?.name}
                            <ChevronDown className="h-4 w-4" />
                        </button>
                        {showLanguageDropdown && (
                            <div className="absolute left-0 top-full z-10 mt-1 rounded-lg bg-gray-700 py-1 shadow-xl">
                                {LANGUAGES.map(lang => (
                                    <button
                                        key={lang.id}
                                        onClick={() => handleLanguageChange(lang.id)}
                                        className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-600 ${
                                            language === lang.id ? "text-sky-400" : "text-white"
                                        }`}
                                    >
                                        {lang.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Theme Toggle */}
                    <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-white"
                    >
                        {THEMES.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700 hover:text-white"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={isRunning}
                        className="flex items-center gap-1 rounded-lg bg-gray-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50"
                    >
                        {isRunning ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Play className="h-4 w-4" />
                        )}
                        Run
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isRunning || readOnly}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                        <Check className="h-4 w-4" />
                        Submit
                    </button>
                </div>
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-0">
                <Editor
                    height="100%"
                    language={language === "cpp" ? "cpp" : language}
                    theme={theme}
                    value={code}
                    onChange={(value) => setCode(value || "")}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                        readOnly,
                        padding: { top: 16 },
                    }}
                />
            </div>

            {/* Test Cases / Results Panel */}
            <div className="border-t border-gray-700 bg-gray-800">
                {/* Tabs */}
                <div className="flex border-b border-gray-700">
                    <button
                        onClick={() => setActiveTab("testcases")}
                        className={`px-4 py-2 text-sm font-medium ${
                            activeTab === "testcases"
                                ? "border-b-2 border-sky-500 text-sky-400"
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        Test Cases
                    </button>
                    <button
                        onClick={() => setActiveTab("results")}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${
                            activeTab === "results"
                                ? "border-b-2 border-sky-500 text-sky-400"
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        Results
                        {results.length > 0 && (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${
                                passedCount === totalVisible
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-amber-500/20 text-amber-400"
                            }`}>
                                {passedCount}/{totalVisible}
                            </span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="max-h-48 overflow-y-auto p-4">
                    {activeTab === "testcases" ? (
                        <div className="space-y-3">
                            {testCases.filter(tc => !tc.is_hidden).map((tc, i) => (
                                <div key={tc.id} className="rounded-lg bg-gray-900 p-3">
                                    <p className="mb-2 text-xs font-medium text-gray-400">Test Case {i + 1}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="mb-1 text-xs text-gray-500">Input</p>
                                            <pre className="rounded bg-gray-950 p-2 text-sm text-gray-300 whitespace-pre-wrap">
                                                {formatForDisplay(tc.input)}
                                            </pre>
                                        </div>
                                        <div>
                                            <p className="mb-1 text-xs text-gray-500">Expected Output</p>
                                            <pre className="rounded bg-gray-950 p-2 text-sm text-gray-300 whitespace-pre-wrap">
                                                {formatForDisplay(tc.expected_output)}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {testCases.some(tc => tc.is_hidden) && (
                                <p className="text-xs text-gray-500">
                                    + {testCases.filter(tc => tc.is_hidden).length} hidden test cases
                                </p>
                            )}
                            {testCases.length === 0 && (
                                <p className="text-sm text-gray-500">No test cases available</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {isRunning ? (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Running tests with Judge0...</span>
                                </div>
                            ) : results.length > 0 ? (
                                <>
                                    {/* Execution Stats */}
                                    {executionStats && (
                                        <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {executionStats.time_ms.toFixed(0)}ms total
                                            </span>
                                            {executionStats.memory_kb && (
                                                <span className="flex items-center gap-1">
                                                    <Zap className="h-3 w-3" />
                                                    {(executionStats.memory_kb / 1024).toFixed(1)}MB
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {results.map((result, i) => (
                                        <div
                                            key={i}
                                            className={`rounded-lg p-3 ${
                                                result.passed
                                                    ? "bg-emerald-500/10"
                                                    : result.status === "compilation_error"
                                                    ? "bg-orange-500/10"
                                                    : result.status === "timeout"
                                                    ? "bg-yellow-500/10"
                                                    : "bg-red-500/10"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {result.passed ? (
                                                        <Check className="h-5 w-5 text-emerald-500" />
                                                    ) : (
                                                        <X className={`h-5 w-5 ${
                                                            result.status === "compilation_error" ? "text-orange-500" :
                                                            result.status === "timeout" ? "text-yellow-500" : "text-red-500"
                                                        }`} />
                                                    )}
                                                    <p className={`text-sm font-medium ${
                                                        result.passed ? "text-emerald-400" :
                                                        result.status === "compilation_error" ? "text-orange-400" :
                                                        result.status === "timeout" ? "text-yellow-400" : "text-red-400"
                                                    }`}>
                                                        Test Case {i + 1}: {
                                                            result.passed ? "Passed" :
                                                            result.status === "compilation_error" ? "Compilation Error" :
                                                            result.status === "timeout" ? "Time Limit Exceeded" :
                                                            result.status === "runtime_error" ? "Runtime Error" : "Failed"
                                                        }
                                                    </p>
                                                </div>
                                                {result.time_ms !== undefined && (
                                                    <span className="text-xs text-gray-500">{result.time_ms.toFixed(0)}ms</span>
                                                )}
                                            </div>
                                            {!result.passed && (
                                                <div className="mt-2 ml-8 space-y-1 text-xs">
                                                    {result.input && (
                                                        <div className="flex gap-2">
                                                            <span className="text-gray-500 w-16 shrink-0">Input:</span>
                                                            <pre className="text-cyan-400 whitespace-pre-wrap">{formatForDisplay(result.input)}</pre>
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <span className="text-gray-500 w-16 shrink-0">Expected:</span>
                                                        <pre className="text-green-400 whitespace-pre-wrap">{formatForDisplay(result.expected)}</pre>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <span className="text-gray-500 w-16 shrink-0">Got:</span>
                                                        <pre className="text-red-400 whitespace-pre-wrap">{formatForDisplay(result.output)}</pre>
                                                    </div>
                                                    {result.error && (
                                                        <div className="mt-2 p-2 bg-black/30 rounded border border-orange-500/30">
                                                            <code className="text-orange-400 whitespace-pre-wrap text-xs">{result.error}</code>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    Click "Run" to execute your code against test cases
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
