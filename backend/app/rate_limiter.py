"""
Rate Limiting Configuration
Prevents abuse of expensive AI endpoints.
"""

import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize limiter with IP-based key
limiter = Limiter(key_func=get_remote_address)

# Rate limit configurations
AI_RATE_LIMIT = os.getenv("AI_RATE_LIMIT", "10/minute")  # AI endpoints
DEFAULT_RATE_LIMIT = os.getenv("DEFAULT_RATE_LIMIT", "60/minute")  # General endpoints
