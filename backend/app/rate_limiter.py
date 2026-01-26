"""
Rate Limiting Configuration
Prevents abuse of expensive AI endpoints and game answer spam.
"""

import os
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def get_player_key(request: Request) -> str:
    """Get rate limit key based on player_id from request body or IP address.

    This allows rate limiting per-player rather than per-IP, which is more
    appropriate for games where multiple students might share an IP.
    """
    # Try to get player_id from request state (set by middleware or endpoint)
    player_id = getattr(request.state, "player_id", None)
    if player_id:
        return f"player:{player_id}"
    # Fallback to IP address
    return get_remote_address(request)


# Initialize limiter with IP-based key (default)
limiter = Limiter(key_func=get_remote_address)

# Rate limit configurations
AI_RATE_LIMIT = os.getenv("AI_RATE_LIMIT", "10/minute")  # AI endpoints
DEFAULT_RATE_LIMIT = os.getenv("DEFAULT_RATE_LIMIT", "60/minute")  # General endpoints
ANSWER_RATE_LIMIT = os.getenv("ANSWER_RATE_LIMIT", "2/second")  # Answer submission (per IP)
