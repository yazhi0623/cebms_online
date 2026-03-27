from fastapi import Request


def get_client_ip(request: Request) -> str:
    """Return the real client IP, preferring proxy forwarding headers when present."""
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip

    if request.client and request.client.host:
        return request.client.host

    return "unknown"
