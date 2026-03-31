from __future__ import annotations

import json
from dataclasses import dataclass
from urllib import error, parse, request

from app.core.config import settings


@dataclass(slots=True)
class WeatherSnapshot:
    location_label: str
    is_sunny: bool
    is_daylight: bool
    weather_code: int | None = None


class WeatherService:
    SUNNY_WEATHER_CODES = {0, 1, 2}

    def get_current_snapshot(self) -> WeatherSnapshot | None:
        if not settings.ANALYSIS_WEATHER_ENABLED:
            return None

        if settings.ANALYSIS_WEATHER_LATITUDE is None or settings.ANALYSIS_WEATHER_LONGITUDE is None:
            return None

        query = parse.urlencode(
            {
                "latitude": settings.ANALYSIS_WEATHER_LATITUDE,
                "longitude": settings.ANALYSIS_WEATHER_LONGITUDE,
                "current": "is_day,weather_code",
                "timezone": "auto",
                "forecast_days": 1,
            }
        )
        url = f"https://api.open-meteo.com/v1/forecast?{query}"

        try:
            with request.urlopen(url, timeout=settings.ANALYSIS_WEATHER_TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError):
            return None

        current = payload.get("current")
        if not isinstance(current, dict):
            return None

        weather_code = current.get("weather_code")
        is_day = current.get("is_day")
        if not isinstance(weather_code, int) or not isinstance(is_day, int):
            return None

        return WeatherSnapshot(
            location_label=settings.ANALYSIS_WEATHER_LOCATION_LABEL.strip() or "当前地区",
            is_sunny=weather_code in self.SUNNY_WEATHER_CODES,
            is_daylight=is_day == 1,
            weather_code=weather_code,
        )
