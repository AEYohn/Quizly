import { useEffect, useRef, useState, useCallback } from "react";
import { API_URL } from "@/lib/api";

// Message types from backend
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
  remaining?: number;
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
  playerId?: string;
  enabled?: boolean;
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
  onHostDisconnected?: () => void;
  onScoreUpdate?: (data: ScoreUpdateMessage) => void;
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

function getWebSocketUrl(): string {
  return API_URL.replace(/^http/, "ws");
}

export function useGameSocket(options: UseGameSocketOptions): UseGameSocketReturn {
  const {
    gameId,
    playerId,
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

  // Store callbacks in refs
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
    onHostDisconnected,
    onScoreUpdate,
    onError,
  });

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
      onHostDisconnected,
      onScoreUpdate,
      onError,
    };
  }, [
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
    onHostDisconnected,
    onScoreUpdate,
    onError,
  ]);

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
        const time = (message.time_remaining ?? message.remaining) as number;
        setTimeRemaining(time);
        callbacks.onTimerTick?.({ time_remaining: time, remaining: time });
        break;
      }

      case "question_start":
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
        break;

      case "player_disconnected":
        const disconnectedData = message as unknown as PlayerDisconnectedMessage;
        setPlayerCount(disconnectedData.player_count);
        callbacks.onPlayerDisconnected?.(disconnectedData);
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
      case "command_received":
        break;

      case "error":
        console.error("WebSocket error message:", message);
        callbacks.onError?.(
          new Error(String(message.message || message.error || "Unknown error"))
        );
        break;

      default:
        console.log("Unknown WebSocket message type:", message.type, message);
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !playerId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = getWebSocketUrl();
    const url = `${wsUrl}/ws/game/${gameId}/player?player_id=${playerId}`;

    console.log("Connecting to WebSocket:", url);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected to game:", gameId);
      setIsConnected(true);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        setLastMessage(message);
        handleMessage(message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Reconnect on unexpected close
      if (enabled && event.code !== 1000 && event.code !== 1001) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("Attempting to reconnect WebSocket...");
          connect();
        }, 3000);
      }
    };

    ws.onerror = () => {
      callbacksRef.current.onError?.(new Error("WebSocket connection error"));
    };
  }, [gameId, playerId, enabled, handleMessage]);

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
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  useEffect(() => {
    if (enabled && playerId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, playerId, connect, disconnect]);

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
