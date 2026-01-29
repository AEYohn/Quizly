"""
Sentry Error Monitoring Configuration for Quizly Backend.

Provides centralized error tracking and performance monitoring.
"""

import os
from typing import Any, Optional

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration


def filter_health_checks(event: dict, hint: dict) -> Optional[dict]:
    """Filter out health check endpoints from performance monitoring.

    Excludes /health, /metrics, and root endpoints to reduce noise.
    """
    if event.get("type") == "transaction":
        transaction_name = event.get("transaction", "")
        # Exclude health check and metrics endpoints
        excluded_endpoints = ["/health", "/health/ready", "/metrics", "/"]
        if transaction_name in excluded_endpoints:
            return None
    return event


def init_sentry() -> bool:
    """Initialize Sentry error monitoring.

    Checks for SENTRY_DSN environment variable and configures
    Sentry SDK with appropriate settings based on environment.

    Returns:
        True if Sentry was initialized, False otherwise.
    """
    sentry_dsn = os.getenv("SENTRY_DSN")

    if not sentry_dsn:
        return False

    environment = os.getenv("ENVIRONMENT", "development")

    # Set traces sample rate based on environment
    # Production: sample 10% of transactions for performance
    # Development: sample all for debugging
    traces_sample_rate = 0.1 if environment == "production" else 1.0

    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=environment,
        traces_sample_rate=traces_sample_rate,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
        before_send_transaction=filter_health_checks,
        # Don't send PII by default
        send_default_pii=False,
        # Attach stack traces to all messages
        attach_stacktrace=True,
    )

    return True


def capture_exception(
    exception: Exception,
    context: Optional[dict[str, Any]] = None,
    level: str = "error"
) -> Optional[str]:
    """Capture an exception and send to Sentry with optional context.

    Args:
        exception: The exception to capture.
        context: Optional dictionary of additional context data.
        level: Severity level (error, warning, info).

    Returns:
        The Sentry event ID if captured, None if Sentry not configured.
    """
    if not os.getenv("SENTRY_DSN"):
        return None

    with sentry_sdk.push_scope() as scope:
        if context:
            for key, value in context.items():
                scope.set_extra(key, value)
        scope.level = level
        return sentry_sdk.capture_exception(exception)


def set_user_context(
    user_id: str,
    email: Optional[str] = None,
    username: Optional[str] = None,
    role: Optional[str] = None
) -> None:
    """Set user context for Sentry error reports.

    Args:
        user_id: Unique user identifier.
        email: User's email address (optional).
        username: User's display name (optional).
        role: User's role (e.g., 'teacher', 'student') (optional).
    """
    if not os.getenv("SENTRY_DSN"):
        return

    user_data: dict[str, Any] = {"id": user_id}

    if email:
        user_data["email"] = email
    if username:
        user_data["username"] = username
    if role:
        user_data["role"] = role

    sentry_sdk.set_user(user_data)


def clear_user_context() -> None:
    """Clear the current user context."""
    if os.getenv("SENTRY_DSN"):
        sentry_sdk.set_user(None)
