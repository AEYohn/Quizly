"""Routes package for Quizly API."""

from . import (
    # DEPRECATED: auth_routes and auth_routes_enhanced removed in Phase 4.1 (Clerk-only auth)
    session_routes as session_routes,
    response_routes as response_routes,
    analytics_routes as analytics_routes,
    ai_routes as ai_routes,
    curriculum_routes as curriculum_routes,
    live_session_routes as live_session_routes,
    adaptive_routes as adaptive_routes,
    quiz_routes as quiz_routes,
    game_routes as game_routes,
    websocket_routes as websocket_routes,
)
