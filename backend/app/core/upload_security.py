from fastapi import HTTPException, status


def enforce_upload_size_limit(file_bytes: bytes, max_bytes: int, *, label: str) -> bytes:
    """Reject oversized uploads without changing downstream parsing behavior."""
    if len(file_bytes) > max_bytes:
        limit_mb = max_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{label} exceeds the {limit_mb}MB upload limit",
        )
    return file_bytes
