"""
Structured Logging Configuration for Quizly

Provides:
- JSON-formatted logs for production
- Human-readable logs for development
- Request context tracking
- Performance timing
"""

import os
import sys
import json
import logging
import time
from datetime import datetime
from typing import Any, Dict, Optional
from contextvars import ContextVar
from functools import wraps

# Context variables for request tracking
request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
user_id_ctx: ContextVar[Optional[str]] = ContextVar("user_id", default=None)


class JSONFormatter(logging.Formatter):
    """JSON log formatter for production."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add context
        if request_id_ctx.get():
            log_data["request_id"] = request_id_ctx.get()
        if user_id_ctx.get():
            log_data["user_id"] = user_id_ctx.get()

        # Add extra fields
        if hasattr(record, "extra_data"):
            log_data.update(record.extra_data)

        # Add exception info
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add location
        log_data["location"] = f"{record.filename}:{record.lineno}"

        return json.dumps(log_data, default=str)


class DevFormatter(logging.Formatter):
    """Human-readable formatter for development."""

    COLORS = {
        "DEBUG": "\033[36m",    # Cyan
        "INFO": "\033[32m",     # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",    # Red
        "CRITICAL": "\033[35m", # Magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        reset = self.RESET

        # Build prefix with context
        prefix_parts = []
        if request_id_ctx.get():
            prefix_parts.append(f"[{request_id_ctx.get()[:8]}]")
        if user_id_ctx.get():
            prefix_parts.append(f"[user:{user_id_ctx.get()[:8]}]")
        prefix = " ".join(prefix_parts)

        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        level = f"{color}{record.levelname:8}{reset}"

        message = record.getMessage()

        # Add extra data if present
        if hasattr(record, "extra_data") and record.extra_data:
            extra_str = " | " + " ".join(f"{k}={v}" for k, v in record.extra_data.items())
            message += extra_str

        return f"{timestamp} {level} {prefix} {message}"


def setup_logging(
    level: str = None,
    json_format: bool = None
) -> logging.Logger:
    """
    Configure application logging.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR)
        json_format: Use JSON format (True for production)

    Returns:
        Root logger
    """
    # Determine settings from environment
    if level is None:
        level = os.getenv("LOG_LEVEL", "INFO")
    if json_format is None:
        json_format = os.getenv("LOG_FORMAT", "dev").lower() == "json"

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers
    root_logger.handlers = []

    # Create handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Set formatter
    if json_format:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(DevFormatter())

    root_logger.addHandler(handler)

    # Reduce noise from libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    return root_logger


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the given name."""
    return logging.getLogger(name)


class LoggerAdapter(logging.LoggerAdapter):
    """Logger adapter with extra context support."""

    def process(self, msg, kwargs):
        extra = kwargs.get("extra", {})
        if self.extra:
            extra.update(self.extra)
        kwargs["extra"] = extra
        return msg, kwargs


def log_with_context(logger: logging.Logger, level: int, message: str, **extra):
    """Log a message with extra context data."""
    record = logger.makeRecord(
        logger.name,
        level,
        "(unknown)",
        0,
        message,
        (),
        None
    )
    record.extra_data = extra
    logger.handle(record)


# Convenience functions
def log_info(logger: logging.Logger, message: str, **extra):
    """Log info with extra context."""
    log_with_context(logger, logging.INFO, message, **extra)


def log_warning(logger: logging.Logger, message: str, **extra):
    """Log warning with extra context."""
    log_with_context(logger, logging.WARNING, message, **extra)


def log_error(logger: logging.Logger, message: str, **extra):
    """Log error with extra context."""
    log_with_context(logger, logging.ERROR, message, **extra)


def log_debug(logger: logging.Logger, message: str, **extra):
    """Log debug with extra context."""
    log_with_context(logger, logging.DEBUG, message, **extra)


def timed(logger: logging.Logger = None):
    """Decorator to log function execution time."""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            log = logger or logging.getLogger(func.__module__)
            start = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                duration_ms = (time.perf_counter() - start) * 1000
                log_info(log, f"{func.__name__} completed", duration_ms=round(duration_ms, 2))
                return result
            except Exception as e:
                duration_ms = (time.perf_counter() - start) * 1000
                log_error(log, f"{func.__name__} failed", duration_ms=round(duration_ms, 2), error=str(e))
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            log = logger or logging.getLogger(func.__module__)
            start = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.perf_counter() - start) * 1000
                log_info(log, f"{func.__name__} completed", duration_ms=round(duration_ms, 2))
                return result
            except Exception as e:
                duration_ms = (time.perf_counter() - start) * 1000
                log_error(log, f"{func.__name__} failed", duration_ms=round(duration_ms, 2), error=str(e))
                raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


# Request tracking middleware helper
def set_request_context(request_id: str, user_id: str = None):
    """Set request context for logging."""
    request_id_ctx.set(request_id)
    if user_id:
        user_id_ctx.set(user_id)


def clear_request_context():
    """Clear request context."""
    request_id_ctx.set(None)
    user_id_ctx.set(None)
