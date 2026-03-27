from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from threading import Lock
from time import time

from fastapi import HTTPException, status

from app.core.config import settings


@dataclass
class _AttemptBucket:
    timestamps: deque[float] = field(default_factory=deque)


class AuthRateLimiter:
    """Track failed login attempts per client in memory."""

    def __init__(self) -> None:
        self._attempts: dict[str, _AttemptBucket] = {}
        self._lock = Lock()

    def ensure_login_allowed(self, client_key: str) -> None:
        if not settings.AUTH_LOGIN_RATE_LIMIT_ENABLED:
            return

        with self._lock:
            bucket = self._attempts.get(client_key)
            if bucket is None:
                return

            self._prune(bucket)
            if len(bucket.timestamps) < settings.AUTH_LOGIN_RATE_LIMIT_ATTEMPTS:
                return

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts, please try again later",
        )

    def record_login_failure(self, client_key: str) -> None:
        if not settings.AUTH_LOGIN_RATE_LIMIT_ENABLED:
            return

        with self._lock:
            bucket = self._attempts.setdefault(client_key, _AttemptBucket())
            self._prune(bucket)
            bucket.timestamps.append(time())

    def clear_login_failures(self, client_key: str) -> None:
        with self._lock:
            self._attempts.pop(client_key, None)

    def reset(self) -> None:
        with self._lock:
            self._attempts.clear()

    @staticmethod
    def _prune(bucket: _AttemptBucket) -> None:
        cutoff = time() - settings.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS
        while bucket.timestamps and bucket.timestamps[0] < cutoff:
            bucket.timestamps.popleft()


auth_rate_limiter = AuthRateLimiter()
