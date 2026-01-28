"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Plus, Trash2, Layers, FileText, Grid3X3 } from "lucide-react";

const templates = [
    { id: "match_pairs", name: "Match Pairs", description: "Match terms with their definitions", icon: Grid3X3 },
    { id: "fill_blank", name: "Fill in the Blank", description: "Complete sentences with missing words", icon: FileText },
    { id: "sort_it", name: "Sort It", description: "Sort items into the correct categories", icon: Layers }
];

interface Pair {
    id: string;
    term: string;
    definition: string;
}

interface Sentence {
    id: string;
    text: string;
    answer: string;
}

interface Category {
    id: string;
    name: string;
    items: string[];
}

export default function GameBuilderPage() {
    const router = useRouter();
    const { token } = useAuth();

    // Step state
    const [step, setStep] = useState<"template" | "content">("template");
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Match Pairs state
    const [pairs, setPairs] = useState<Pair[]>([
        { id: crypto.randomUUID(), term: "", definition: "" }
    ]);

    // Fill Blank state
    const [sentences, setSentences] = useState<Sentence[]>([
        { id: crypto.randomUUID(), text: "", answer: "" }
    ]);

    // Sort It state
    const [categories, setCategories] = useState<Category[]>([
        { id: crypto.randomUUID(), name: "", items: [""] }
    ]);

    const handleTemplateSelect = (templateId: string) => {
        setSelectedTemplate(templateId);
        setStep("content");
    };

    const buildGameData = () => {
        switch (selectedTemplate) {
            case "match_pairs":
                return {
                    pairs: pairs
                        .filter(p => p.term.trim() && p.definition.trim())
                        .map(p => ({ term: p.term, definition: p.definition }))
                };
            case "fill_blank":
                return {
                    sentences: sentences
                        .filter(s => s.text.trim() && s.answer.trim())
                        .map(s => ({ text: s.text, answer: s.answer }))
                };
            case "sort_it":
                return {
                    categories: categories
                        .filter(c => c.name.trim() && c.items.some(i => i.trim()))
                        .map(c => ({
                            name: c.name,
                            items: c.items.filter(i => i.trim())
                        }))
                };
            default:
                return {};
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            setError("Please enter a title for your game");
            return;
        }

        const gameData = buildGameData();

        // Validate content
        if (selectedTemplate === "match_pairs" && (!gameData.pairs || gameData.pairs.length === 0)) {
            setError("Please add at least one pair");
            return;
        }
        if (selectedTemplate === "fill_blank" && (!gameData.sentences || gameData.sentences.length === 0)) {
            setError("Please add at least one sentence");
            return;
        }
        if (selectedTemplate === "sort_it" && (!gameData.categories || gameData.categories.length === 0)) {
            setError("Please add at least one category with items");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/library/games`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    title,
                    template: selectedTemplate,
                    content: gameData
                })
            });

            if (!response.ok) {
                throw new Error("Failed to save game");
            }

            router.push("/student/library");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save game");
        } finally {
            setSaving(false);
        }
    };

    // Match Pairs handlers
    const addPair = () => {
        setPairs([...pairs, { id: crypto.randomUUID(), term: "", definition: "" }]);
    };

    const updatePair = (id: string, field: "term" | "definition", value: string) => {
        setPairs(pairs.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const removePair = (id: string) => {
        if (pairs.length > 1) {
            setPairs(pairs.filter(p => p.id !== id));
        }
    };

    // Fill Blank handlers
    const addSentence = () => {
        setSentences([...sentences, { id: crypto.randomUUID(), text: "", answer: "" }]);
    };

    const updateSentence = (id: string, field: "text" | "answer", value: string) => {
        setSentences(sentences.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const removeSentence = (id: string) => {
        if (sentences.length > 1) {
            setSentences(sentences.filter(s => s.id !== id));
        }
    };

    // Sort It handlers
    const addCategory = () => {
        setCategories([...categories, { id: crypto.randomUUID(), name: "", items: [""] }]);
    };

    const updateCategoryName = (id: string, name: string) => {
        setCategories(categories.map(c => c.id === id ? { ...c, name } : c));
    };

    const addCategoryItem = (categoryId: string) => {
        setCategories(categories.map(c =>
            c.id === categoryId ? { ...c, items: [...c.items, ""] } : c
        ));
    };

    const updateCategoryItem = (categoryId: string, itemIndex: number, value: string) => {
        setCategories(categories.map(c =>
            c.id === categoryId
                ? { ...c, items: c.items.map((item, i) => i === itemIndex ? value : item) }
                : c
        ));
    };

    const removeCategoryItem = (categoryId: string, itemIndex: number) => {
        setCategories(categories.map(c =>
            c.id === categoryId && c.items.length > 1
                ? { ...c, items: c.items.filter((_, i) => i !== itemIndex) }
                : c
        ));
    };

    const removeCategory = (id: string) => {
        if (categories.length > 1) {
            setCategories(categories.filter(c => c.id !== id));
        }
    };

    const renderTemplateSelection = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {templates.map((template) => {
                const Icon = template.icon;
                return (
                    <button
                        key={template.id}
                        onClick={() => handleTemplateSelect(template.id)}
                        className="p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all text-left"
                    >
                        <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                            <Icon className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>
                        <p className="text-sm text-gray-600">{template.description}</p>
                    </button>
                );
            })}
        </div>
    );

    const renderMatchPairsEditor = () => (
        <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
                Add pairs of terms and their definitions. Players will match them together.
            </p>
            {pairs.map((pair, index) => (
                <div key={pair.id} className="flex gap-4 items-start">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Term {index + 1}
                        </label>
                        <input
                            type="text"
                            value={pair.term}
                            onChange={(e) => updatePair(pair.id, "term", e.target.value)}
                            placeholder="Enter term"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Definition
                        </label>
                        <input
                            type="text"
                            value={pair.definition}
                            onChange={(e) => updatePair(pair.id, "definition", e.target.value)}
                            placeholder="Enter definition"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <button
                        onClick={() => removePair(pair.id)}
                        className="mt-7 p-2 text-gray-400 hover:text-red-500 transition-colors"
                        disabled={pairs.length === 1}
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            ))}
            <button
                onClick={addPair}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
                <Plus className="w-4 h-4" />
                Add Pair
            </button>
        </div>
    );

    const renderFillBlankEditor = () => (
        <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
                Create sentences with blanks. Use &quot;____&quot; to mark where the answer goes.
            </p>
            {sentences.map((sentence, index) => (
                <div key={sentence.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Sentence {index + 1}</span>
                        <button
                            onClick={() => removeSentence(sentence.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            disabled={sentences.length === 1}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    <input
                        type="text"
                        value={sentence.text}
                        onChange={(e) => updateSentence(sentence.id, "text", e.target.value)}
                        placeholder="The ____ is the powerhouse of the cell."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Answer
                        </label>
                        <input
                            type="text"
                            value={sentence.answer}
                            onChange={(e) => updateSentence(sentence.id, "answer", e.target.value)}
                            placeholder="mitochondria"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>
            ))}
            <button
                onClick={addSentence}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
                <Plus className="w-4 h-4" />
                Add Sentence
            </button>
        </div>
    );

    const renderSortItEditor = () => (
        <div className="space-y-6">
            <p className="text-sm text-gray-600 mb-4">
                Create categories and add items that belong to each category.
            </p>
            {categories.map((category, categoryIndex) => (
                <div key={category.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Category {categoryIndex + 1}</span>
                        <button
                            onClick={() => removeCategory(category.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            disabled={categories.length === 1}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    <input
                        type="text"
                        value={category.name}
                        onChange={(e) => updateCategoryName(category.id, e.target.value)}
                        placeholder="Category name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Items</label>
                        {category.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex gap-2">
                                <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => updateCategoryItem(category.id, itemIndex, e.target.value)}
                                    placeholder={`Item ${itemIndex + 1}`}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <button
                                    onClick={() => removeCategoryItem(category.id, itemIndex)}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    disabled={category.items.length === 1}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => addCategoryItem(category.id)}
                            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                        >
                            <Plus className="w-3 h-3" />
                            Add Item
                        </button>
                    </div>
                </div>
            ))}
            <button
                onClick={addCategory}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
                <Plus className="w-4 h-4" />
                Add Category
            </button>
        </div>
    );

    const renderContentEditor = () => {
        const template = templates.find(t => t.id === selectedTemplate);

        return (
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Game Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter a title for your game"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                <div className="p-4 bg-indigo-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        {template && <template.icon className="w-5 h-5 text-indigo-600" />}
                        <div>
                            <h3 className="font-medium text-indigo-900">{template?.name}</h3>
                            <p className="text-sm text-indigo-700">{template?.description}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    {selectedTemplate === "match_pairs" && renderMatchPairsEditor()}
                    {selectedTemplate === "fill_blank" && renderFillBlankEditor()}
                    {selectedTemplate === "sort_it" && renderSortItEditor()}
                </div>

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                <div className="flex justify-end gap-4">
                    <button
                        onClick={() => setStep("template")}
                        className="px-6 py-3 text-gray-700 hover:text-gray-900 font-medium"
                    >
                        Back to Templates
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Game
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <Link
                        href="/student/library"
                        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Library
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {step === "template" ? "Choose a Game Template" : "Create Your Game"}
                    </h1>
                    <p className="text-gray-600 mt-2">
                        {step === "template"
                            ? "Select a template to start building your game"
                            : "Fill in the content for your game"}
                    </p>
                </div>

                {step === "template" ? renderTemplateSelection() : renderContentEditor()}
            </div>
        </div>
    );
}
