"use client";

import { useState, useEffect } from "react";
import { useScrollSessionStore } from "~/stores/scrollSessionStore";
import { useHomeScreen, useSkillTree, useActiveFeed } from "~/hooks/feed";
import { HomeScreen } from "./HomeScreen";
import { SkillTree } from "./SkillTree";
import { ActiveFeed } from "./ActiveFeed";
import { SkillTreeAnalysis } from "~/components/feed/SkillTreeAnalysis";
import { useAuth, getStudentName } from "~/lib/auth";

function StaleSessionGuard({ onReset }: { onReset: () => void }) {
    const [showButton, setShowButton] = useState(false);

    useEffect(() => {
        const buttonTimer = setTimeout(() => setShowButton(true), 3000);
        const autoReset = setTimeout(() => onReset(), 10000);
        return () => { clearTimeout(buttonTimer); clearTimeout(autoReset); };
    }, [onReset]);

    return (
        <div className="h-full bg-[#050510] flex items-center justify-center">
            <div className="text-center space-y-3">
                <div className="relative w-12 h-12 mx-auto">
                    <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
                    <div className="relative w-12 h-12 flex items-center justify-center">
                        <svg
                            className="w-6 h-6 text-indigo-400 animate-pulse"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path d="M12 2l2.09 6.26L20.18 9.27l-5.09 3.7L16.18 19.24 12 15.77l-4.18 3.47 1.09-6.27-5.09-3.7 6.09-1.01z" />
                        </svg>
                    </div>
                </div>
                <p className="text-indigo-300/60 text-sm">Loading next cards...</p>
                {showButton && (
                    <button
                        onClick={onReset}
                        className="mt-4 px-5 py-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-all"
                    >
                        Start Over
                    </button>
                )}
            </div>
        </div>
    );
}

function CosmicFeed() {
    const auth = useAuth();
    const store = useScrollSessionStore();
    const homeScreen = useHomeScreen();
    const skillTree = useSkillTree(homeScreen.handleQuickStart);
    const activeFeed = useActiveFeed(homeScreen.answerStartTime);

    // Active feed state
    if (store.sessionId) {
        const currentCard = store.cards[store.currentIdx];
        if (!currentCard) {
            return <StaleSessionGuard onReset={() => store.reset()} />;
        }

        return (
            <ActiveFeed
                currentCard={currentCard}
                cards={store.cards}
                currentIdx={store.currentIdx}
                stats={store.stats}
                result={store.result}
                analytics={store.analytics}
                flashcardXp={store.flashcardXp}
                infoAcknowledged={store.infoAcknowledged}
                showHelp={store.showHelp}
                sessionId={store.sessionId}
                selectedSubject={store.selectedSubject}
                sessionAnalytics={activeFeed.sessionAnalytics}
                showAnalytics={activeFeed.showAnalytics}
                showTuneSheet={activeFeed.showTuneSheet}
                showNotes={activeFeed.showNotes}
                uploadedFile={activeFeed.uploadedFile}
                isProcessingFile={activeFeed.isProcessingFile}
                onAnswer={activeFeed.handleAnswer}
                onNext={activeFeed.handleNext}
                onSkip={activeFeed.handleSkip}
                onHelp={() => store.setShowHelp(true)}
                onCloseHelp={() => store.setShowHelp(false)}
                onFlashcardRate={activeFeed.handleFlashcardRate}
                onInfoGotIt={activeFeed.handleInfoGotIt}
                onShowAnalytics={activeFeed.handleShowAnalytics}
                onCloseAnalytics={() => activeFeed.setShowAnalytics(false)}
                onOpenTuneSheet={() => activeFeed.setShowTuneSheet(true)}
                onCloseTuneSheet={() => activeFeed.setShowTuneSheet(false)}
                onFileUpload={activeFeed.handleFileUpload}
                onToggleNotes={() => activeFeed.setShowNotes(!activeFeed.showNotes)}
                onReset={() => { store.reset(); activeFeed.setShowTuneSheet(false); }}
                notesData={activeFeed.topicNotesData}
                notesLoading={!activeFeed.topicNotesData && !!store.activeSyllabusNode}
            />
        );
    }

    // Skill tree state
    if (store.syllabus && store.selectedSubject) {
        const totalPresence = Object.values(store.presence).reduce((a, b) => a + b, 0);
        return (
            <>
                <SkillTree
                    syllabus={store.syllabus}
                    mastery={store.mastery}
                    presence={store.presence}
                    recommendedNext={store.recommendedNext}
                    totalPresence={totalPresence}
                    resourceCount={store.subjectResources.length}
                    isUploading={store.isUploadingResource}
                    isLoading={store.isLoading}
                    loadingMessage={homeScreen.loadingMessage}
                    error={store.error}
                    showRegenBanner={skillTree.showRegenBanner}
                    isRegenerating={skillTree.isRegenerating}
                    subjectResources={store.subjectResources}
                    showResourceSheet={skillTree.showResourceSheet}
                    onNodeTap={skillTree.handleNodeTap}
                    onStartLearning={skillTree.handleStartLearning}
                    onStudyNotes={skillTree.handleStudyNotes}
                    onQuizOnly={skillTree.handleQuizOnly}
                    onFlashcardsOnly={skillTree.handleFlashcardsOnly}
                    recentSessions={skillTree.recentSessions}
                    onBack={() => store.clearSyllabus()}
                    onUploadResource={skillTree.handleUploadResource}
                    onManageResources={() => skillTree.setShowResourceSheet(true)}
                    onDeleteResource={skillTree.handleDeleteResource}
                    onRegenerateSyllabus={skillTree.handleRegenerateSyllabus}
                    onDismissRegenBanner={() => skillTree.setShowResourceSheet(false)}
                    onCloseResourceSheet={() => skillTree.setShowResourceSheet(false)}
                    onStartAssessment={skillTree.handleStartAssessment}
                    assessmentPhase={store.assessmentPhase}
                    topicResources={skillTree.topicResources}
                    onOpenAnalysis={() => skillTree.setShowAnalysis(true)}
                    onGenerateFromResources={skillTree.handleGenerateFromResources}
                    isGeneratingContent={store.isGeneratingContent}
                    generationProgress={store.generationProgress}
                />
                <SkillTreeAnalysis
                    open={skillTree.showAnalysis}
                    onClose={() => skillTree.setShowAnalysis(false)}
                    subject={store.selectedSubject!}
                    studentName={getStudentName(auth.user)}
                    onStudyNow={(concept) => {
                        skillTree.setShowAnalysis(false);
                        const topic = store.syllabus!.units
                            .flatMap((u) => u.topics)
                            .find((t) => t.name === concept || t.concepts.some((c) => c.toLowerCase() === concept.toLowerCase()));
                        if (topic) {
                            skillTree.handleNodeTap(topic);
                        }
                    }}
                />
            </>
        );
    }

    // Home screen
    return (
        <HomeScreen
            history={store.history}
            historyOverall={store.historyOverall}
            suggestions={store.suggestions}
            activeSession={store.activeSession}
            topicInput={store.topicInput}
            syllabusLoading={store.syllabusLoading}
            isLoading={store.isLoading}
            error={store.error}
            onTopicInputChange={(v) => store.setTopicInput(v)}
            onSubjectSelect={homeScreen.handleSubjectSelect}
            onQuickStart={homeScreen.handleQuickStart}
            onPdfUpload={homeScreen.handlePdfUpload}
            pdfUploading={store.syllabusLoading}
            pdfUploadStage={homeScreen.pdfUploadStage}
            onDeleteSubject={homeScreen.handleDeleteSubject}
            timeAgo={homeScreen.timeAgo}
            onCodebaseAnalyze={homeScreen.handleCodebaseAnalyze}
            codebaseLoading={store.codebaseLoading}
            githubUrlInput={store.githubUrlInput}
            onGithubUrlInputChange={(v) => store.setGithubUrlInput(v)}
        />
    );
}

export { CosmicFeed as Feed };
