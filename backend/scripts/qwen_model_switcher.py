"""
Model switch helper for backend AI analysis.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


MODELS_JSON_PATH = Path(__file__).resolve().parents[1] / "config" / "models.json"


def _load_config(models_path: Path = MODELS_JSON_PATH) -> dict[str, Any]:
    if not models_path.exists():
        return {}
    return json.loads(models_path.read_text(encoding="utf-8"))


def _save_config(config: dict[str, Any], models_path: Path = MODELS_JSON_PATH) -> None:
    models_path.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def get_all_models(models_path: Path = MODELS_JSON_PATH) -> tuple[list[dict[str, Any]], int, dict[str, Any]]:
    config = _load_config(models_path)
    models = [item for item in config.get("models", []) if isinstance(item, dict) and isinstance(item.get("name"), str)]
    current_model_index = config.get("current_model_index", 0)
    if not isinstance(current_model_index, int) or current_model_index < 0 or current_model_index >= max(len(models), 1):
        current_model_index = 0
    return models, current_model_index, config


def get_qwen_models(models_path: Path = MODELS_JSON_PATH) -> tuple[list[dict[str, Any]], int, dict[str, Any]]:
    models, current_model_index, config = get_all_models(models_path)
    if not models:
        return [], 0, config

    if current_model_index >= len(models):
        current_model_index = len(models) - 1

    return models, current_model_index, config


def get_next_model_index(models_path: Path = MODELS_JSON_PATH) -> int:
    models, current_model_index, _ = get_qwen_models(models_path)
    if not models:
        return 0
    return min(current_model_index + 1, len(models) - 1)


def standard_time(timestamp: float | int) -> str:
    return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")


def change_model(status_code: int | None = None, models_path: Path = MODELS_JSON_PATH) -> int:
    models, current_model_index, config = get_qwen_models(models_path)
    if not models:
        return 0

    current_model = models[current_model_index].get("name", "unknown")
    failed_attempts = config.setdefault("failed_attempts", {})
    failed_attempts[current_model] = {
        "failed_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status_code": status_code,
    }

    next_model_index = min(current_model_index + 1, len(models) - 1)
    config["current_model_index"] = next_model_index
    config["last_updated"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _save_config(config, models_path)
    return next_model_index


if __name__ == "__main__":
    change_model()
