"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2,
    Plus,
    Search,
    Filter,
    Grid,
    List,
    BookOpen,
    StickyNote,
    Gamepad2,
    Layers,
    Trash2,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useAuth } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// TypeScript interfaces
interface StudyItem {
    id: string;
    type: string;
    title: string;
    description: string | null;
    visibility: string;
    tags: string[];
    source: string;
    times_studied: number;
    last_studied_at: string | null;
    created_at: string;
    updated_at: string;
}

interface Collection {
    id: string;
    name: string;
    description: string | null;
    cover_color: string;
    visibility: string;
    created_at: string;
    updated_at: string;
    item_count: number;
}

// Icons and labels for content types
const typeIcons: Record<string, typeof BookOpen> = {
    flashcard_deck: Layers,
    note: StickyNote,
    game: Gamepad2,
};

const typeLabels: Record<string, string> = {
    flashcard_deck: "Flashcards",
    note: "Notes",
    game: "Games",
};

export default function LibraryPage() {
    const router = useRouter();
    const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
    const { token, isAuthenticated, isLoading: authLoading } = useAuth();

    // State
    const [items, setItems] = useState<StudyItem[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<string>("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // Fetch data when token is available
    useEffect(() => {
        if (!clerkLoaded || authLoading) return;

        if (!isAuthenticated) {
            router.push("/sign-in");
            return;
        }

        if (token) {
            fetchData();
        }
    }, [clerkLoaded, authLoading, isAuthenticated, token, router]);

    const fetchData = async () => {
        if (!token) return;

        setLoading(true);
        setError(null);

        try {
            // Fetch items and collections in parallel
            const [itemsRes, collectionsRes] = await Promise.all([
                fetch(`${API_URL}/library/items`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_URL}/library/collections`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (itemsRes.ok) {
                const data = await itemsRes.json();
                setItems(data.items || []);
            } else {
                console.error("Failed to fetch items:", itemsRes.status);
            }

            if (collectionsRes.ok) {
                const data = await collectionsRes.json();
                setCollections(data.collections || []);
            } else {
                console.error("Failed to fetch collections:", collectionsRes.status);
            }
        } catch (err) {
            console.error("Error fetching library data:", err);
            setError("Failed to load library. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!token) return;
        if (!confirm("Delete this item? This cannot be undone.")) return;

        try {
            const response = await fetch(`${API_URL}/library/items/${itemId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setItems((prev) => prev.filter((item) => item.id !== itemId));
            } else {
                alert("Failed to delete item");
            }
        } catch (err) {
            console.error("Error deleting item:", err);
            alert("Failed to delete item");
        }
    };

    // Filter items by search and type
    const filteredItems = items.filter((item) => {
        const matchesSearch =
            searchQuery === "" ||
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

        const matchesType = filterType === "all" || item.type === filterType;

        return matchesSearch && matchesType;
    });

    // Loading state
    if (loading || authLoading || !clerkLoaded) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 flex">
            {/* Left Sidebar - Collections */}
            <aside className="w-64 border-r border-gray-800 bg-gray-900 p-4 flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Collections
                </h2>

                {collections.length === 0 ? (
                    <p className="text-sm text-gray-500">No collections yet</p>
                ) : (
                    <ul className="space-y-2">
                        {collections.map((collection) => (
                            <li key={collection.id}>
                                <Link
                                    href={`/student/library/collections/${collection.id}`}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: collection.cover_color }}
                                    />
                                    <span className="text-sm text-gray-300 truncate">
                                        {collection.name}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-auto">
                                        {collection.item_count}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}

                <Link
                    href="/student/library/collections/new"
                    className="mt-4 flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 px-3 py-2"
                >
                    <Plus className="h-4 w-4" />
                    New Collection
                </Link>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-white">My Library</h1>
                    <Link
                        href="/student/create"
                        className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 transition-colors"
                    >
                        <Plus className="h-5 w-5" />
                        Create
                    </Link>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search your library..."
                            className="w-full rounded-lg border border-gray-800 bg-gray-900 pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                    </div>

                    {/* Type Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="appearance-none rounded-lg border border-gray-800 bg-gray-900 pl-10 pr-8 py-2 text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        >
                            <option value="all">All Types</option>
                            <option value="flashcard_deck">Flashcards</option>
                            <option value="note">Notes</option>
                            <option value="game">Games</option>
                        </select>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-2 rounded-md transition-colors ${
                                viewMode === "grid"
                                    ? "bg-gray-800 text-white"
                                    : "text-gray-500 hover:text-white"
                            }`}
                            title="Grid view"
                        >
                            <Grid className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-2 rounded-md transition-colors ${
                                viewMode === "list"
                                    ? "bg-gray-800 text-white"
                                    : "text-gray-500 hover:text-white"
                            }`}
                            title="List view"
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
                        {error}
                    </div>
                )}

                {/* Items Grid/List */}
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <BookOpen className="h-16 w-16 text-gray-600 mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">
                            {items.length === 0
                                ? "Your library is empty"
                                : "No items match your search"}
                        </h3>
                        <p className="text-gray-400 mb-6">
                            {items.length === 0
                                ? "Start by creating flashcards, notes, or games"
                                : "Try adjusting your search or filter"}
                        </p>
                        {items.length === 0 && (
                            <Link
                                href="/student/create"
                                className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 transition-colors"
                            >
                                <Plus className="h-5 w-5" />
                                Create Your First Item
                            </Link>
                        )}
                    </div>
                ) : (
                    <div
                        className={
                            viewMode === "grid"
                                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                                : "space-y-3"
                        }
                    >
                        {filteredItems.map((item) => {
                            const TypeIcon = typeIcons[item.type] || BookOpen;
                            const typeLabel = typeLabels[item.type] || item.type;

                            return (
                                <div
                                    key={item.id}
                                    className={`group relative rounded-xl border border-gray-800 bg-gray-900 transition-all hover:border-gray-700 ${
                                        viewMode === "list"
                                            ? "flex items-center gap-4 p-4"
                                            : "p-5"
                                    }`}
                                >
                                    {/* Item Content */}
                                    <Link
                                        href={`/student/library/${item.type}/${item.id}`}
                                        className="flex-1 block"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 text-gray-400 flex-shrink-0">
                                                <TypeIcon className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-white truncate group-hover:text-sky-400 transition-colors">
                                                    {item.title}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    {typeLabel}
                                                </p>
                                                {viewMode === "grid" && item.description && (
                                                    <p className="mt-2 text-sm text-gray-400 line-clamp-2">
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        {viewMode === "grid" && (
                                            <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                                                <span>Studied {item.times_studied}x</span>
                                                {item.last_studied_at && (
                                                    <span>
                                                        Last:{" "}
                                                        {new Date(
                                                            item.last_studied_at
                                                        ).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Tags */}
                                        {viewMode === "grid" && item.tags.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {item.tags.slice(0, 3).map((tag, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-2 py-0.5 rounded-full bg-gray-800 text-xs text-gray-400"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                                {item.tags.length > 3 && (
                                                    <span className="text-xs text-gray-500">
                                                        +{item.tags.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </Link>

                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className={`text-gray-600 hover:text-red-400 transition-colors ${
                                            viewMode === "grid"
                                                ? "absolute top-3 right-3 opacity-0 group-hover:opacity-100"
                                                : ""
                                        }`}
                                        title="Delete item"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
