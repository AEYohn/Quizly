"use client";

import { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { Play, RotateCcw, Check, X, Loader2, ChevronDown, Clock, Zap, Plus, Trash2 } from "lucide-react";
import { codeApi, type TestCaseInput, type CodeExecutionResult } from "~/lib/api";
import { ResizableDivider } from "./ResizableDivider";

interface TestCase {
    id: number;
    input: string;
    expected_output: string;
    is_hidden?: boolean;
}

type VariableType = "int" | "float" | "string" | "bool" | "list[int]" | "list[str]" | "list[float]" | "list[list[int]]" | "list" | "object";

interface ParsedVariable {
    name: string;
    value: string;
    type: VariableType;
}

// Type badge colors
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
    "int": { bg: "bg-blue-500/20", text: "text-blue-400" },
    "float": { bg: "bg-blue-500/20", text: "text-blue-400" },
    "string": { bg: "bg-green-500/20", text: "text-green-400" },
    "bool": { bg: "bg-orange-500/20", text: "text-orange-400" },
    "list[int]": { bg: "bg-teal-500/20", text: "text-teal-400" },
    "list[str]": { bg: "bg-teal-500/20", text: "text-teal-400" },
    "list[float]": { bg: "bg-teal-500/20", text: "text-teal-400" },
    "list[list[int]]": { bg: "bg-pink-500/20", text: "text-pink-400" },
    "list": { bg: "bg-teal-500/20", text: "text-teal-400" },
    "object": { bg: "bg-gray-500/20", text: "text-gray-400" },
};

interface EditableTestCase {
    id: number;
    variables: ParsedVariable[];
    expected_output: string;
    isCustom?: boolean;
}

interface CodeEditorProps {
    problemId?: number;
    initialCode?: string;
    language?: string;
    testCases?: TestCase[];
    driverCode?: Record<string, string>;
    functionName?: string;
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

// Parse key=value format string into variables
function parseKeyValueString(input: string): ParsedVariable[] {
    const variables: ParsedVariable[] = [];

    // Pattern handles: nums = [1,2,3], target = 9 on the same line
    const pattern = /(\w+)\s*=\s*(\[(?:[^\[\]]*|\[(?:[^\[\]]*|\[[^\[\]]*\])*\])*\]|\{[^}]*\}|-?\d+(?:\.\d+)?|"[^"]*"|'[^']*'|true|false|null|True|False|None)/gi;
    let match;

    while ((match = pattern.exec(input)) !== null) {
        const name = match[1];
        let value = match[2];

        if (!name || !value) continue;

        // Normalize Python-style values to JSON
        if (value.toLowerCase() === 'true') value = 'true';
        else if (value.toLowerCase() === 'false') value = 'false';
        else if (value.toLowerCase() === 'none' || value.toLowerCase() === 'null') value = 'null';
        else if (value.startsWith("'") && value.endsWith("'")) {
            value = '"' + value.slice(1, -1) + '"';
        }

        try {
            const parsed = JSON.parse(value);
            variables.push({
                name,
                value: JSON.stringify(parsed),
                type: getValueType(parsed),
            });
        } catch {
            variables.push({
                name,
                value: `"${value}"`,
                type: "string",
            });
        }
    }

    return variables;
}

// Parse JSON or key=value input to variable format
function parseInputToVariables(input: string): ParsedVariable[] {
    if (!input || input.trim() === "") return [];

    const variables: ParsedVariable[] = [];

    // Try parsing as JSON first
    try {
        const parsed = JSON.parse(input);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            for (const [key, value] of Object.entries(parsed)) {
                // Check if value is a string that contains more key=value pairs
                // This handles malformed input like {"nums": "[1,2,3], target=6"}
                if (typeof value === "string" && value.includes("=")) {
                    const nestedVars = parseKeyValueString(`${key}=${value}`);
                    if (nestedVars.length > 1) {
                        variables.push(...nestedVars);
                        continue;
                    }
                }
                variables.push({
                    name: key,
                    value: JSON.stringify(value),
                    type: getValueType(value),
                });
            }
            return variables;
        }
    } catch {
        // Not JSON, try key=value format
    }

    // Try key=value format
    const keyValueVars = parseKeyValueString(input);
    if (keyValueVars.length > 0) {
        return keyValueVars;
    }

    // If no variables found, treat the entire input as a single value
    if (input.trim()) {
        variables.push({
            name: "input",
            value: input.trim(),
            type: "string",
        });
    }

    return variables;
}

function getValueType(value: unknown): VariableType {
    if (Array.isArray(value)) {
        if (value.length === 0) return "list";
        const first = value[0];
        // Check for 2D array
        if (Array.isArray(first)) {
            if (first.length === 0 || typeof first[0] === "number") return "list[list[int]]";
            return "list";
        }
        // Check element types
        if (typeof first === "number") {
            // Check if any element is a float
            const hasFloat = value.some(v => typeof v === "number" && !Number.isInteger(v));
            return hasFloat ? "list[float]" : "list[int]";
        }
        if (typeof first === "string") return "list[str]";
        return "list";
    }
    if (typeof value === "number") {
        return Number.isInteger(value) ? "int" : "float";
    }
    if (typeof value === "boolean") return "bool";
    if (typeof value === "object" && value !== null) return "object";
    return "string";
}

// Convert variables back to JSON format for API
function variablesToJson(variables: ParsedVariable[]): string {
    if (variables.length === 0) return "{}";
    const first = variables[0];
    if (variables.length === 1 && first && first.name === "input") {
        return first.value;
    }

    const obj: Record<string, unknown> = {};
    for (const v of variables) {
        try {
            obj[v.name] = JSON.parse(v.value);
        } catch {
            obj[v.name] = v.value;
        }
    }
    return JSON.stringify(obj);
}

// Format variables for display (LeetCode style)
function formatVariablesForDisplay(variables: ParsedVariable[]): string {
    return variables
        .map(v => `${v.name} = ${v.value}`)
        .join("\n");
}

export function CodeEditor({
    problemId,
    initialCode,
    language: initialLanguage = "python",
    testCases = [],
    driverCode,
    functionName = "solution",
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

    // LeetCode-style test case state
    const [selectedTestCaseIndex, setSelectedTestCaseIndex] = useState(0);
    const [editableTestCases, setEditableTestCases] = useState<EditableTestCase[]>([]);
    const [testPanelHeight, setTestPanelHeight] = useState(224); // pixels (14rem = 224px)

    const handleVerticalResize = useCallback((delta: number) => {
        setTestPanelHeight(prev => {
            // Clamp between 100px and 500px
            return Math.min(500, Math.max(100, prev - delta));
        });
    }, []);

    // Update code when initialCode changes (e.g., language switch)
    useEffect(() => {
        if (initialCode) {
            setCode(initialCode);
        }
    }, [initialCode]);

    // Initialize editable test cases from props
    useEffect(() => {
        const visibleTestCases = testCases.filter(tc => !tc.is_hidden);
        const editable: EditableTestCase[] = visibleTestCases.map((tc, i) => ({
            id: tc.id || i,
            variables: parseInputToVariables(tc.input),
            expected_output: tc.expected_output,
            isCustom: false,
        }));
        setEditableTestCases(editable);
        setSelectedTestCaseIndex(0);
    }, [testCases]);

    // Handle variable value change
    const handleVariableChange = useCallback((testCaseIndex: number, variableIndex: number, newValue: string) => {
        setEditableTestCases(prev => {
            const updated = [...prev];
            if (updated[testCaseIndex] && updated[testCaseIndex].variables[variableIndex]) {
                updated[testCaseIndex] = {
                    ...updated[testCaseIndex],
                    variables: updated[testCaseIndex].variables.map((v, i) =>
                        i === variableIndex ? { ...v, value: newValue } : v
                    ),
                };
            }
            return updated;
        });
    }, []);

    // Add custom test case
    const handleAddTestCase = useCallback(() => {
        const getDefaultValue = (type: VariableType): string => {
            if (type.startsWith("list")) return "[]";
            if (type === "int" || type === "float") return "0";
            if (type === "bool") return "false";
            return '""';
        };

        const templateVariables = editableTestCases[0]?.variables.map(v => ({
            ...v,
            value: getDefaultValue(v.type),
        })) || [{ name: "input", value: '""', type: "string" as VariableType }];

        setEditableTestCases(prev => [
            ...prev,
            {
                id: Date.now(),
                variables: templateVariables,
                expected_output: "",
                isCustom: true,
            },
        ]);
        setSelectedTestCaseIndex(editableTestCases.length);
    }, [editableTestCases]);

    // Remove custom test case
    const handleRemoveTestCase = useCallback((index: number) => {
        setEditableTestCases(prev => prev.filter((_, i) => i !== index));
        setSelectedTestCaseIndex(prev => Math.max(0, prev - 1));
    }, []);

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

        // Convert editable test cases to API format
        const apiTestCases: TestCaseInput[] = editableTestCases.map(tc => ({
            input: variablesToJson(tc.variables),
            expected_output: tc.expected_output,
            is_hidden: false,
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
            // Get driver code for current language
            const currentDriverCode = driverCode?.[language];

            // Use batch API for multiple test cases, regular API for single
            const res = apiTestCases.length > 1
                ? await codeApi.runCodeBatch(code, language, apiTestCases, functionName, currentDriverCode)
                : await codeApi.runCode(code, language, apiTestCases, functionName, currentDriverCode);

            if (res.success && res.data) {
                const data = res.data;

                // Store execution stats
                setExecutionStats({
                    time_ms: data.overall_time_ms,
                    memory_kb: data.test_results[0]?.memory_kb,
                });

                // Map results to frontend format with LeetCode-style display
                const mappedResults = data.test_results.map((tr, i) => ({
                    passed: tr.status === "passed",
                    output: tr.actual_output || (tr.error_message ? `Error: ${tr.error_message}` : "No output"),
                    expected: tr.expected_output || editableTestCases[i]?.expected_output,
                    input: formatVariablesForDisplay(editableTestCases[i]?.variables || []),
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

            {/* Resizable Divider */}
            <ResizableDivider
                direction="vertical"
                onResize={handleVerticalResize}
                className="bg-gray-700"
            />

            {/* Test Cases / Results Panel - LeetCode Style */}
            <div
                className="bg-gray-800 flex flex-col"
                style={{ height: testPanelHeight }}
            >
                {/* Main Tabs */}
                <div className="flex border-b border-gray-700 flex-shrink-0">
                    <button
                        onClick={() => setActiveTab("testcases")}
                        className={`px-4 py-2 text-sm font-medium ${
                            activeTab === "testcases"
                                ? "border-b-2 border-sky-500 text-sky-400"
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        Testcase
                    </button>
                    <button
                        onClick={() => setActiveTab("results")}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${
                            activeTab === "results"
                                ? "border-b-2 border-sky-500 text-sky-400"
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        Test Result
                        {results.length > 0 && (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${
                                passedCount === editableTestCases.length
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-red-500/20 text-red-400"
                            }`}>
                                {passedCount}/{editableTestCases.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {activeTab === "testcases" ? (
                        <div className="p-4">
                            {/* Test Case Tabs - LeetCode Style */}
                            <div className="flex items-center gap-1 mb-4 flex-wrap">
                                {editableTestCases.map((tc, i) => (
                                    <button
                                        key={tc.id}
                                        onClick={() => setSelectedTestCaseIndex(i)}
                                        className={`relative flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                            selectedTestCaseIndex === i
                                                ? "bg-gray-700 text-white"
                                                : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800"
                                        }`}
                                    >
                                        Case {i + 1}
                                        {tc.isCustom && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveTestCase(i);
                                                }}
                                                className="ml-1 text-gray-500 hover:text-red-400"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                    </button>
                                ))}
                                <button
                                    onClick={handleAddTestCase}
                                    className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-500 hover:text-white rounded-lg hover:bg-gray-700"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Selected Test Case Content - LeetCode Style */}
                            {editableTestCases[selectedTestCaseIndex] && (
                                <div className="space-y-4">
                                    {editableTestCases[selectedTestCaseIndex].variables.map((variable, varIndex) => {
                                        const defaultColor = { bg: "bg-gray-500/20", text: "text-gray-400" };
                                        const typeColor = TYPE_COLORS[variable.type] ?? defaultColor;
                                        return (
                                            <div key={varIndex}>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-sm font-medium text-gray-300">
                                                        {variable.name}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor.bg} ${typeColor.text}`}>
                                                        {variable.type}
                                                    </span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={variable.value}
                                                    onChange={(e) => handleVariableChange(selectedTestCaseIndex, varIndex, e.target.value)}
                                                    className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-sm text-white font-mono focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                    placeholder={`Enter ${variable.name}`}
                                                />
                                            </div>
                                        );
                                    })}
                                    {editableTestCases[selectedTestCaseIndex].variables.length === 0 && (
                                        <p className="text-sm text-gray-500">No input variables</p>
                                    )}
                                </div>
                            )}

                            {editableTestCases.length === 0 && (
                                <p className="text-sm text-gray-500">No test cases available</p>
                            )}

                            {testCases.some(tc => tc.is_hidden) && (
                                <p className="mt-4 text-xs text-gray-500">
                                    + {testCases.filter(tc => tc.is_hidden).length} hidden test cases will be evaluated on submit
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="p-4">
                            {isRunning ? (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Running...</span>
                                </div>
                            ) : results.length > 0 ? (
                                <>
                                    {/* LeetCode-Style Results Header */}
                                    <div className={`mb-4 p-4 rounded-lg ${
                                        passedCount === results.length
                                            ? "bg-emerald-500/10"
                                            : "bg-red-500/10"
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className={`text-xl font-bold ${
                                                    passedCount === results.length
                                                        ? "text-emerald-400"
                                                        : "text-red-400"
                                                }`}>
                                                    {passedCount === results.length ? "Accepted" : "Wrong Answer"}
                                                </p>
                                                {executionStats && (
                                                    <p className="text-sm text-gray-400 mt-1">
                                                        Runtime: {executionStats.time_ms.toFixed(0)} ms
                                                        {executionStats.memory_kb && (
                                                            <span className="ml-2">
                                                                Memory: {(executionStats.memory_kb / 1024).toFixed(1)} MB
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-semibold text-white">
                                                    {passedCount}/{results.length}
                                                </p>
                                                <p className="text-xs text-gray-500">testcases passed</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Test Case Tabs in Results */}
                                    <div className="flex items-center gap-1 mb-4 flex-wrap">
                                        {results.map((result, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedTestCaseIndex(i)}
                                                className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                                    selectedTestCaseIndex === i
                                                        ? "bg-gray-700 text-white"
                                                        : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800"
                                                }`}
                                            >
                                                {result.passed ? (
                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                ) : (
                                                    <X className="h-3 w-3 text-red-500" />
                                                )}
                                                Case {i + 1}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Selected Result Details - LeetCode Style */}
                                    {results[selectedTestCaseIndex] && (
                                        <div className="space-y-3">
                                            {/* Input */}
                                            {results[selectedTestCaseIndex].input && (
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Input</p>
                                                    <pre className="rounded-lg bg-gray-900 p-3 text-sm text-gray-300 font-mono whitespace-pre-wrap">
                                                        {formatForDisplay(results[selectedTestCaseIndex].input)}
                                                    </pre>
                                                </div>
                                            )}
                                            {/* Output */}
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Output</p>
                                                <pre className={`rounded-lg bg-gray-900 p-3 text-sm font-mono whitespace-pre-wrap ${
                                                    results[selectedTestCaseIndex].passed ? "text-gray-300" : "text-red-400"
                                                }`}>
                                                    {formatForDisplay(results[selectedTestCaseIndex].output)}
                                                </pre>
                                            </div>
                                            {/* Expected */}
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Expected</p>
                                                <pre className="rounded-lg bg-gray-900 p-3 text-sm text-emerald-400 font-mono whitespace-pre-wrap">
                                                    {formatForDisplay(results[selectedTestCaseIndex].expected)}
                                                </pre>
                                            </div>
                                            {/* Error if any */}
                                            {results[selectedTestCaseIndex].error && (
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">Error</p>
                                                    <pre className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-orange-400 font-mono whitespace-pre-wrap">
                                                        {results[selectedTestCaseIndex].error}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
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
