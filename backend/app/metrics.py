"""
Prometheus Metrics for Quizly

Provides application metrics for monitoring:
- Request counts and latency
- Game/player activity
- WebSocket connections
- Error rates
"""

import time
from functools import wraps
from typing import Callable

from prometheus_client import Counter, Histogram, Gauge, Info, REGISTRY, generate_latest
from prometheus_client.exposition import CONTENT_TYPE_LATEST


# =============================================================================
# Application Info
# =============================================================================

APP_INFO = Info("quizly", "Quizly application information")
APP_INFO.info({
    "version": "0.1.0",
    "service": "quizly-api",
})


# =============================================================================
# HTTP Metrics
# =============================================================================

HTTP_REQUESTS_TOTAL = Counter(
    "quizly_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

HTTP_REQUEST_DURATION = Histogram(
    "quizly_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "quizly_http_requests_in_progress",
    "HTTP requests currently in progress",
    ["method", "endpoint"]
)


# =============================================================================
# Game Metrics
# =============================================================================

GAMES_CREATED = Counter(
    "quizly_games_created_total",
    "Total games created",
    ["mode"]  # sync or async
)

GAMES_ACTIVE = Gauge(
    "quizly_games_active",
    "Currently active games"
)

PLAYERS_JOINED = Counter(
    "quizly_players_joined_total",
    "Total players joined games"
)

PLAYERS_ACTIVE = Gauge(
    "quizly_players_active",
    "Currently active players"
)

ANSWERS_SUBMITTED = Counter(
    "quizly_answers_submitted_total",
    "Total answers submitted",
    ["correct"]
)

ANSWER_LATENCY = Histogram(
    "quizly_answer_latency_seconds",
    "Time between question shown and answer submitted",
    buckets=[1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120]
)


# =============================================================================
# WebSocket Metrics
# =============================================================================

WEBSOCKET_CONNECTIONS = Gauge(
    "quizly_websocket_connections",
    "Active WebSocket connections",
    ["game_id"]
)

WEBSOCKET_MESSAGES_SENT = Counter(
    "quizly_websocket_messages_sent_total",
    "Total WebSocket messages sent",
    ["message_type"]
)


# =============================================================================
# AI/Gemini Metrics
# =============================================================================

AI_REQUESTS = Counter(
    "quizly_ai_requests_total",
    "Total AI/Gemini API requests",
    ["operation", "status"]
)

AI_REQUEST_DURATION = Histogram(
    "quizly_ai_request_duration_seconds",
    "AI/Gemini API request duration",
    ["operation"],
    buckets=[0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 15.0, 30.0]
)


# =============================================================================
# Database Metrics
# =============================================================================

DB_QUERY_DURATION = Histogram(
    "quizly_db_query_duration_seconds",
    "Database query duration",
    ["operation"],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0]
)


# =============================================================================
# Error Metrics
# =============================================================================

ERRORS_TOTAL = Counter(
    "quizly_errors_total",
    "Total errors",
    ["type", "endpoint"]
)


# =============================================================================
# Helper Functions
# =============================================================================

def track_request_start(method: str, endpoint: str):
    """Track that a request has started."""
    HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).inc()


def track_request_end(method: str, endpoint: str, status: int, duration: float):
    """Track that a request has completed."""
    HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).dec()
    HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status=str(status)).inc()
    HTTP_REQUEST_DURATION.labels(method=method, endpoint=endpoint).observe(duration)


def track_game_created(mode: str = "sync"):
    """Track a game creation."""
    GAMES_CREATED.labels(mode=mode).inc()
    GAMES_ACTIVE.inc()


def track_game_ended():
    """Track a game ending."""
    GAMES_ACTIVE.dec()


def track_player_joined():
    """Track a player joining."""
    PLAYERS_JOINED.inc()
    PLAYERS_ACTIVE.inc()


def track_player_left():
    """Track a player leaving."""
    PLAYERS_ACTIVE.dec()


def track_answer(correct: bool, latency_seconds: float = None):
    """Track an answer submission."""
    ANSWERS_SUBMITTED.labels(correct=str(correct).lower()).inc()
    if latency_seconds is not None:
        ANSWER_LATENCY.observe(latency_seconds)


def track_websocket_connect(game_id: str):
    """Track a WebSocket connection."""
    WEBSOCKET_CONNECTIONS.labels(game_id=game_id).inc()


def track_websocket_disconnect(game_id: str):
    """Track a WebSocket disconnection."""
    WEBSOCKET_CONNECTIONS.labels(game_id=game_id).dec()


def track_websocket_message(message_type: str):
    """Track a WebSocket message sent."""
    WEBSOCKET_MESSAGES_SENT.labels(message_type=message_type).inc()


def track_ai_request(operation: str, success: bool, duration: float):
    """Track an AI API request."""
    status = "success" if success else "error"
    AI_REQUESTS.labels(operation=operation, status=status).inc()
    AI_REQUEST_DURATION.labels(operation=operation).observe(duration)


def track_error(error_type: str, endpoint: str):
    """Track an error."""
    ERRORS_TOTAL.labels(type=error_type, endpoint=endpoint).inc()


def timed_operation(operation: str):
    """Decorator to time and track an operation."""
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.perf_counter()
            success = True
            try:
                return await func(*args, **kwargs)
            except Exception:
                success = False
                raise
            finally:
                duration = time.perf_counter() - start
                if "ai" in operation.lower() or "gemini" in operation.lower():
                    track_ai_request(operation, success, duration)
                else:
                    DB_QUERY_DURATION.labels(operation=operation).observe(duration)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.perf_counter()
            success = True
            try:
                return func(*args, **kwargs)
            except Exception:
                success = False
                raise
            finally:
                duration = time.perf_counter() - start
                if "ai" in operation.lower() or "gemini" in operation.lower():
                    track_ai_request(operation, success, duration)
                else:
                    DB_QUERY_DURATION.labels(operation=operation).observe(duration)

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def get_metrics() -> bytes:
    """Generate Prometheus metrics output."""
    return generate_latest(REGISTRY)


def get_metrics_content_type() -> str:
    """Get the content type for metrics response."""
    return CONTENT_TYPE_LATEST
