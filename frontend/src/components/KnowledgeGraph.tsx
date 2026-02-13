"use client";

import { useMemo, useState } from "react";
import { GitBranch, Target, CheckCircle, AlertTriangle, Lock, ChevronRight, Lightbulb } from "lucide-react";

interface ConceptNode {
    id: string;
    name: string;
    description?: string;
    prerequisites: string[];
    mastery: number; // 0-1
    questionsAnswered: number;
    accuracy: number;
}

interface KnowledgeGraphProps {
    concepts: ConceptNode[];
    className?: string;
}

function getMasteryColor(mastery: number): string {
    if (mastery >= 0.8) return "bg-emerald-500";
    if (mastery >= 0.6) return "bg-amber-500";
    if (mastery >= 0.4) return "bg-orange-500";
    return "bg-red-500";
}

function getMasteryBgColor(mastery: number): string {
    if (mastery >= 0.8) return "bg-emerald-500/10 border-emerald-500/30";
    if (mastery >= 0.6) return "bg-amber-500/10 border-amber-500/30";
    if (mastery >= 0.4) return "bg-orange-500/10 border-orange-500/30";
    return "bg-red-500/10 border-red-500/30";
}

function getMasteryTextColor(mastery: number): string {
    if (mastery >= 0.8) return "text-emerald-400";
    if (mastery >= 0.6) return "text-amber-400";
    if (mastery >= 0.4) return "text-orange-400";
    return "text-red-400";
}

export function KnowledgeGraph({ concepts, className = "" }: KnowledgeGraphProps) {
    const [selectedConcept, setSelectedConcept] = useState<string | null>(null);

    // Build dependency tree
    const { layers, conceptMap, edges } = useMemo(() => {
        const map = new Map(concepts.map(c => [c.id, c]));
        const edges: { from: string; to: string }[] = [];

        // Find concepts with no prerequisites (root concepts)
        const inDegree = new Map<string, number>();
        concepts.forEach(c => {
            inDegree.set(c.id, 0);
        });

        concepts.forEach(c => {
            c.prerequisites.forEach(prereq => {
                if (map.has(prereq)) {
                    inDegree.set(c.id, (inDegree.get(c.id) || 0) + 1);
                    edges.push({ from: prereq, to: c.id });
                }
            });
        });

        // Topological sort to arrange into layers
        const layers: string[][] = [];
        const visited = new Set<string>();
        const remaining = new Set(concepts.map(c => c.id));

        while (remaining.size > 0) {
            const layer: string[] = [];

            // Find all concepts with no unvisited prerequisites
            remaining.forEach(id => {
                const concept = map.get(id);
                if (!concept) return;

                const hasUnvisitedPrereq = concept.prerequisites.some(
                    prereq => remaining.has(prereq) && !visited.has(prereq)
                );

                if (!hasUnvisitedPrereq) {
                    layer.push(id);
                }
            });

            if (layer.length === 0) {
                // Circular dependency or orphan - just add remaining
                layer.push(...remaining);
                remaining.clear();
            } else {
                layer.forEach(id => {
                    remaining.delete(id);
                    visited.add(id);
                });
            }

            layers.push(layer);
        }

        return { layers, conceptMap: map, edges };
    }, [concepts]);

    const selectedConceptData = selectedConcept ? conceptMap.get(selectedConcept) : null;

    // Find recommended next concepts (prerequisites met but low mastery)
    const recommendations = useMemo(() => {
        return concepts
            .filter(c => {
                // Has all prerequisites mastered
                const prereqsMet = c.prerequisites.every(prereq => {
                    const prereqConcept = conceptMap.get(prereq);
                    return prereqConcept && prereqConcept.mastery >= 0.6;
                });
                // But concept itself needs work
                return prereqsMet && c.mastery < 0.8;
            })
            .sort((a, b) => a.mastery - b.mastery)
            .slice(0, 3);
    }, [concepts, conceptMap]);

    if (concepts.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
                <GitBranch className="h-12 w-12 text-gray-600 mb-3" />
                <p className="text-gray-500">No concept data yet</p>
                <p className="text-sm text-gray-600 mt-1">Complete quizzes to build your knowledge map</p>
            </div>
        );
    }

    return (
        <div className={className}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-sky-400" />
                    Knowledge Map
                </h3>
                <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-gray-400">Mastered</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="text-gray-400">Learning</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-gray-400">Needs Work</span>
                    </div>
                </div>
            </div>

            {/* Visual Graph */}
            <div className="relative bg-gray-900/50 rounded-xl p-4 mb-4 overflow-x-auto">
                <div className="flex flex-col gap-4 min-w-fit">
                    {layers.map((layer, layerIdx) => (
                        <div key={layerIdx} className="flex items-center gap-2">
                            {/* Layer label */}
                            <div className="w-16 text-xs text-gray-500 flex-shrink-0">
                                Level {layerIdx + 1}
                            </div>

                            {/* Concepts in this layer */}
                            <div className="flex flex-wrap gap-2">
                                {layer.map(conceptId => {
                                    const concept = conceptMap.get(conceptId);
                                    if (!concept) return null;

                                    const isSelected = selectedConcept === conceptId;
                                    const isPrereqMet = concept.prerequisites.every(prereq => {
                                        const p = conceptMap.get(prereq);
                                        return p && p.mastery >= 0.6;
                                    });

                                    return (
                                        <button
                                            key={conceptId}
                                            onClick={() => setSelectedConcept(isSelected ? null : conceptId)}
                                            className={`relative px-3 py-2 rounded-lg border transition-all ${
                                                isSelected
                                                    ? "ring-2 ring-sky-500 border-sky-500"
                                                    : getMasteryBgColor(concept.mastery)
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {!isPrereqMet && (
                                                    <Lock className="h-3 w-3 text-gray-500" />
                                                )}
                                                <span className={`text-sm font-medium ${
                                                    isSelected ? "text-white" : getMasteryTextColor(concept.mastery)
                                                }`}>
                                                    {concept.name}
                                                </span>
                                            </div>
                                            {/* Mastery bar */}
                                            <div className="mt-1 h-1 w-full bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${getMasteryColor(concept.mastery)} transition-all`}
                                                    style={{ width: `${concept.mastery * 100}%` }}
                                                />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Selected Concept Details */}
            {selectedConceptData && (
                <div className="mb-4 p-4 rounded-lg bg-sky-500/10 border border-sky-500/30">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="text-white font-medium">{selectedConceptData.name}</h4>
                            {selectedConceptData.description && (
                                <p className="text-sm text-gray-400 mt-1">{selectedConceptData.description}</p>
                            )}
                        </div>
                        <div className="text-right">
                            <p className={`text-2xl font-bold ${getMasteryTextColor(selectedConceptData.mastery)}`}>
                                {Math.round(selectedConceptData.mastery * 100)}%
                            </p>
                            <p className="text-xs text-gray-500">mastery</p>
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-lg font-semibold text-white">
                                {selectedConceptData.questionsAnswered}
                            </p>
                            <p className="text-xs text-gray-500">questions</p>
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-white">
                                {Math.round(selectedConceptData.accuracy * 100)}%
                            </p>
                            <p className="text-xs text-gray-500">accuracy</p>
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-white">
                                {selectedConceptData.prerequisites.length}
                            </p>
                            <p className="text-xs text-gray-500">prerequisites</p>
                        </div>
                    </div>

                    {selectedConceptData.prerequisites.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs text-gray-500 mb-1">Prerequisites:</p>
                            <div className="flex flex-wrap gap-1">
                                {selectedConceptData.prerequisites.map(prereq => {
                                    const prereqConcept = conceptMap.get(prereq);
                                    const isMet = prereqConcept && prereqConcept.mastery >= 0.6;
                                    return (
                                        <span
                                            key={prereq}
                                            className={`px-2 py-0.5 rounded text-xs ${
                                                isMet
                                                    ? "bg-emerald-500/20 text-emerald-400"
                                                    : "bg-red-500/20 text-red-400"
                                            }`}
                                        >
                                            {isMet && <CheckCircle className="inline h-3 w-3 mr-1" />}
                                            {!isMet && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                                            {prereqConcept?.name || prereq}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
                <div className="p-4 rounded-lg bg-teal-500/10 border border-teal-500/30">
                    <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="h-4 w-4 text-teal-400" />
                        <span className="text-sm font-medium text-teal-400">Recommended Focus Areas</span>
                    </div>
                    <div className="space-y-2">
                        {recommendations.map(concept => (
                            <div
                                key={concept.id}
                                className="flex items-center justify-between p-2 rounded bg-gray-800/50"
                            >
                                <div className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-white">{concept.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm ${getMasteryTextColor(concept.mastery)}`}>
                                        {Math.round(concept.mastery * 100)}%
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-gray-500" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default KnowledgeGraph;
