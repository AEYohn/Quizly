"""
LLM Call Utilities

Provides timeout and retry wrapper for Gemini API calls.
"""

import asyncio
from typing import Optional, Any
from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error, log_warning

logger = get_logger(__name__)

# Centralised model name — change here to upgrade everywhere
GEMINI_MODEL_NAME = "gemini-3-flash-preview"

# Default timeout for LLM calls (seconds)
DEFAULT_TIMEOUT = 30
# Default number of retries
DEFAULT_RETRIES = 2
# Base delay for exponential backoff (seconds)
BASE_DELAY = 1.0
# Semaphore to limit concurrent Gemini API calls
_gemini_semaphore = asyncio.Semaphore(5)


async def call_gemini_with_timeout(
    model: Any,
    prompt: str,
    *,
    timeout: int = DEFAULT_TIMEOUT,
    retries: int = DEFAULT_RETRIES,
    generation_config: Optional[Any] = None,
    tools: Optional[Any] = None,
    context: Optional[dict] = None,
) -> Optional[Any]:
    """
    Call Gemini model.generate_content() with timeout and retry logic.

    Args:
        model: The Gemini GenerativeModel instance
        prompt: The prompt string or list of content parts
        timeout: Timeout in seconds per attempt
        retries: Number of retry attempts (0 = no retries)
        generation_config: Optional Gemini generation config
        context: Optional context dict for error reporting

    Returns:
        The Gemini response object, or None if all attempts fail
    """
    last_error: Optional[Exception] = None
    ctx = context or {}

    for attempt in range(retries + 1):
        try:
            kwargs = {}
            if generation_config is not None:
                kwargs["generation_config"] = generation_config
            if tools is not None:
                kwargs["tools"] = tools

            async with _gemini_semaphore:
                response = await asyncio.wait_for(
                    asyncio.to_thread(model.generate_content, prompt, **kwargs),
                    timeout=timeout,
                )

            # Track token usage
            try:
                usage = getattr(response, 'usage_metadata', None)
                if usage:
                    logger.info("LLM token usage",
                        extra={
                            "prompt_tokens": getattr(usage, 'prompt_token_count', 0),
                            "completion_tokens": getattr(usage, 'candidates_token_count', 0),
                            "total_tokens": getattr(usage, 'total_token_count', 0),
                            **ctx,
                        })
            except Exception:
                pass  # Don't fail on usage tracking

            return response

        except asyncio.TimeoutError:
            last_error = TimeoutError(f"Gemini call timed out after {timeout}s")
            log_warning(logger, f"Gemini timeout (attempt {attempt + 1}/{retries + 1})",
                       timeout=timeout, **ctx)

        except Exception as e:
            last_error = e
            log_warning(logger, f"Gemini call failed (attempt {attempt + 1}/{retries + 1})",
                       error=str(e), **ctx)

        # Exponential backoff before retry
        if attempt < retries:
            delay = BASE_DELAY * (2 ** attempt)
            await asyncio.sleep(delay)

    # All attempts failed
    if last_error:
        capture_exception(last_error, context={
            "service": "llm_utils",
            "operation": "call_gemini_with_timeout",
            "attempts": retries + 1,
            **ctx,
        })
        log_error(logger, "All Gemini call attempts failed",
                 attempts=retries + 1, error=str(last_error), **ctx)

    return None
