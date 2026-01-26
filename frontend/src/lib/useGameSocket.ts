"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// API URL from environment
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Message types that can be received from the backend
export type MessageType =
    | "connected"
    | "game_started"
    | "game_state"
    | "timer_tick"
    | "question_start"
    | "question_end"
    | "results"
    | "game_end"
    | "player_connected"
    | "player_disconnected"
    | "player_joined"
    | "player_left"
    | "host_disconnected"
    | "pong"
    | "command_received"
    | "player_count"
    | "score_update"
    | "error";

export interface WebSocketMessage {
    type: MessageType;
    [key: string]: unknown;
}

export interface GameStateMessage {
    status: "lobby" | "question" | "results" | "finished";
    current_question_index: number;
    time_remaining?: number;
    question?: QuestionData;
}

export interface QuestionData {
    question_index: number;
    question_text: string;
    question_type: string;
    options: { [key: string]: string };
    time_limit: number;
    points: number;
}

export interface TimerTickMessage {
    time_remaining: number;
    remaining?: number; // Backend sends both for compatibility
}

export interface QuestionStartMessage {
    question_index: number;
    question_text: string;
    question_type: string;
    options: { [key: string]: string };
    time_limit: number;
    points: number;
}

export interface ResultsMessage {
    question_index: number;
    correct_answer?: string;
    explanation?: string;
}

export interface GameEndMessage {
    message: string;
}

export interface GameStartedMessage {
    question_index: number;
    total_questions: number;
}

export interface PlayerConnectedMessage {
    player_id: string;
    player_count: number;
    nickname?: string;
}

export interface PlayerDisconnectedMessage {
    player_id: string;
    player_count: number;
    nickname?: string;
}

export interface ScoreUpdateMessage {
    player_id: string;
    nickname: string;
    points_earned: number;
    total_score: number;
    is_correct: boolean;
    current_streak: number;
}

export interface ConnectedMessage {
    game_id: string;
    player_id?: string;
    role?: "host";
    player_count?: number;
}

export interface UseGameSocketOptions {
    gameId: string;
    playerId?: string;  // For player connections
    isHost?: boolean;   // For host connections
    token?: string;     // Auth token for host
    enabled?: boolean;  // Whether to connect (default true)
    onConnected?: (data: ConnectedMessage) => void;
    onGameStarted?: (data: GameStartedMessage) => void;
    onGameState?: (state: GameStateMessage) => void;
    onTimerTick?: (data: TimerTickMessage) => void;
    onQuestionStart?: (data: QuestionStartMessage) => void;
    onQuestionEnd?: () => void;
    onResults?: (data: ResultsMessage) => void;
    onGameEnd?: (data: GameEndMessage) => void;
    onPlayerConnected?: (data: PlayerConnectedMessage) => void;
    onPlayerDisconnected?: (data: PlayerDisconnectedMessage) => void;
    onPlayerJoined?: (data: PlayerConnectedMessage) => void;  // Alias for lobby
    onPlayerLeft?: (data: PlayerDisconnectedMessage) => void; // Alias for lobby
    onHostDisconnected?: () => void;
    onScoreUpdate?: (data: ScoreUpdateMessage) => void;  // Real-time score updates
    onError?: (error: Error) => void;
}

export interface UseGameSocketReturn {
    isConnected: boolean;
    lastMessage: WebSocketMessage | null;
    timeRemaining: number | null;
    playerCount: number;
    sendMessage: (message: unknown) => void;
    sendPing: () => void;
    reconnect: () => void;
    disconnect: () => void;
}

// Convert HTTP API URL to WebSocket URL
function getWebSocketUrl(): string {
    const apiUrl = API_URL;
    // Replace http(s):// with ws(s)://
    return apiUrl.replace(/^http/, "ws");
}

export function useGameSocket(options: UseGameSocketOptions): UseGameSocketReturn {
    const {
        gameId,
        playerId,
        isHost = false,
        token,
        enabled = true,
        onConnected,
        onGameStarted,
        onGameState,
        onTimerTick,
        onQuestionStart,
        onQuestionEnd,
        onResults,
        onGameEnd,
        onPlayerConnected,
        onPlayerDisconnected,
        onPlayerJoined,
        onPlayerLeft,
        onHostDisconnected,
        onScoreUpdate,
        onError,
    } = options;

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [playerCount, setPlayerCount] = useState(0);

    // Store callbacks in refs to avoid reconnection on callback changes
    const callbacksRef = useRef({
        onConnected,
        onGameStarted,
        onGameState,
        onTimerTick,
        onQuestionStart,
        onQuestionEnd,
        onResults,
        onGameEnd,
        onPlayerConnected,
        onPlayerDisconnected,
        onPlayerJoined,
        onPlayerLeft,
        onHostDisconnected,
        onScoreUpdate,
        onError,
    });

    // Update refs when callbacks change
    useEffect(() => {
        callbacksRef.current = {
            onConnected,
            onGameStarted,
            onGameState,
            onTimerTick,
            onQuestionStart,
            onQuestionEnd,
            onResults,
            onGameEnd,
            onPlayerConnected,
            onPlayerDisconnected,
            onPlayerJoined,
            onPlayerLeft,
            onHostDisconnected,
            onScoreUpdate,
            onError,
        };
    }, [onConnected, onGameStarted, onGameState, onTimerTick, onQuestionStart, onQuestionEnd, onResults, onGameEnd, onPlayerConnected, onPlayerDisconnected, onPlayerJoined, onPlayerLeft, onHostDisconnected, onScoreUpdate, onError]);

    const handleMessage = useCallback((message: WebSocketMessage) => {
        const callbacks = callbacksRef.current;

        switch (message.type) {
            case "connected":
                callbacks.onConnected?.(message as unknown as ConnectedMessage);
                if (message.player_count !== undefined) {
                    setPlayerCount(message.player_count as number);
                }
                break;

            case "game_started":
                callbacks.onGameStarted?.(message as unknown as GameStartedMessage);
                break;

            case "game_state":
                callbacks.onGameState?.(message as unknown as GameStateMessage);
                break;

            case "timer_tick": {
                // Backend sends time_remaining and/or remaining
                const time = (message.time_remaining ?? message.remaining) as number;
                setTimeRemaining(time);
                callbacks.onTimerTick?.({ time_remaining: time, remaining: time });
                break;
            }

            case "question_start":
                // Backend sends question data directly in the message
                const questionData = message as unknown as QuestionStartMessage;
                setTimeRemaining(questionData.time_limit);
                callbacks.onQuestionStart?.(questionData);
                break;

            case "question_end":
                setTimeRemaining(0);
                callbacks.onQuestionEnd?.();
                break;

            case "results":
                callbacks.onResults?.(message as unknown as ResultsMessage);
                break;

            case "game_end":
                callbacks.onGameEnd?.(message as unknown as GameEndMessage);
                break;

            case "player_connected":
                const connectedData = message as unknown as PlayerConnectedMessage;
                setPlayerCount(connectedData.player_count);
                callbacks.onPlayerConnected?.(connectedData);
                callbacks.onPlayerJoined?.(connectedData); // Alias
                break;

            case "player_disconnected":
                const disconnectedData = message as unknown as PlayerDisconnectedMessage;
                setPlayerCount(disconnectedData.player_count);
                callbacks.onPlayerDisconnected?.(disconnectedData);
                callbacks.onPlayerLeft?.(disconnectedData); // Alias
                break;

            case "player_joined":
                callbacks.onPlayerJoined?.(message as unknown as PlayerConnectedMessage);
                if (message.player_count !== undefined) {
                    setPlayerCount(message.player_count as number);
                }
                break;

            case "player_left":
                callbacks.onPlayerLeft?.(message as unknown as PlayerDisconnectedMessage);
                if (message.player_count !== undefined) {
                    setPlayerCount(message.player_count as number);
                }
                break;

            case "host_disconnected":
                callbacks.onHostDisconnected?.();
                break;

            case "player_count":
                if (message.count !== undefined) {
                    setPlayerCount(message.count as number);
                }
                break;

            case "score_update":
                callbacks.onScoreUpdate?.(message as unknown as ScoreUpdateMessage);
                break;

            case "pong":
                // Ping response, no action needed
                break;

            case "command_received":
                // Host command acknowledgment, no action needed
                break;

            case "error":
                console.error("WebSocket error message:", message);
                callbacks.onError?.(new Error(String(message.message || message.error || "Unknown error")));
                break;

            default:
                console.log("Unknown WebSocket message type:", message.type, message);
        }
    }, []);

    const connect = useCallback(() => {
        if (!enabled) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        // Don't try to connect if we don't have necessary credentials
        if (!isHost && !playerId) {
            // Silent return - this is expected when waiting for player registration
            return;
        }

        const wsUrl = getWebSocketUrl();
        let url: string;

        if (isHost) {
            const authToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
            if (!authToken) {
                console.warn("useGameSocket: No auth token for host connection");
                return;
            }
            url = `${wsUrl}/ws/game/${gameId}/host?token=${authToken}`;
        } else {
            url = `${wsUrl}/ws/game/${gameId}/player?player_id=${playerId}`;
        }

        console.log("Connecting to WebSocket:", url);
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected to game:", gameId);
            setIsConnected(true);

            // Clear any reconnect timeout
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            // Start ping interval to keep connection alive
            pingIntervalRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "ping" }));
                }
            }, 30000); // Ping every 30 seconds
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data) as WebSocketMessage;
                setLastMessage(message);
                handleMessage(message);
            } catch (error) {
                console.error("Failed to parse WebSocket message:", error, event.data);
            }
        };

        ws.onclose = (event) => {
            console.log("WebSocket closed:", event.code, event.reason);
            setIsConnected(false);
            wsRef.current = null;

            // Clear ping interval
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }

            // Attempt to reconnect if it wasn't a clean close and still enabled
            if (enabled && event.code !== 1000 && event.code !== 1001) {
                reconnectTimeoutRef.current = setTimeout(() => {
                    console.log("Attempting to reconnect WebSocket...");
                    connect();
                }, 3000);
            }
        };

        ws.onerror = () => {
            // WebSocket error events don't contain useful info in browsers
            // The actual error will come through onclose
            callbacksRef.current.onError?.(new Error("WebSocket connection error"));
        };
    }, [gameId, playerId, isHost, token, enabled, handleMessage]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close(1000, "Client disconnected");
            wsRef.current = null;
        }

        setIsConnected(false);
    }, []);

    const sendMessage = useCallback((message: unknown) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.warn("WebSocket not connected, cannot send message");
        }
    }, []);

    const sendPing = useCallback(() => {
        sendMessage({ type: "ping" });
    }, [sendMessage]);

    const reconnect = useCallback(() => {
        disconnect();
        setTimeout(connect, 100); // Small delay to ensure clean disconnect
    }, [disconnect, connect]);

    useEffect(() => {
        if (enabled) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [enabled, connect, disconnect]);

    return {
        isConnected,
        lastMessage,
        timeRemaining,
        playerCount,
        sendMessage,
        sendPing,
        reconnect,
        disconnect,
    };
}
