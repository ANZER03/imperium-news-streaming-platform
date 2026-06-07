"""Reusable retry decorator with exponential backoff."""
from __future__ import annotations

import functools
import logging
import time
from typing import Tuple, Type

logger = logging.getLogger(__name__)


def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    retryable: Tuple[Type[BaseException], ...] = (Exception,),
):
    """Decorator that retries on specified exceptions with exponential backoff.

    Args:
        max_attempts: Total attempts (including the first call).
        base_delay: Delay in seconds before the first retry; doubles each time.
        retryable: Tuple of exception types that trigger a retry.
    """

    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            last_exc: BaseException | None = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except retryable as exc:
                    last_exc = exc
                    if attempt == max_attempts:
                        logger.error(
                            "%s failed after %d attempts: %s",
                            fn.__name__, max_attempts, exc,
                        )
                        raise
                    delay = base_delay * (2 ** (attempt - 1))
                    logger.warning(
                        "%s attempt %d/%d failed (%s) — retrying in %.1fs",
                        fn.__name__, attempt, max_attempts, exc, delay,
                    )
                    time.sleep(delay)
            # Unreachable, but satisfies type checkers
            raise last_exc  # type: ignore[misc]

        return wrapper

    return decorator
