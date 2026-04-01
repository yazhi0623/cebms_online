from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.models.record import Record
from app.services.analysis_summary_service import AnalysisSummaryService
from app.services.weather_service import WeatherService
from scripts.qwen_model_switcher import change_model

try:
    from openai import APIError, OpenAI
except ImportError:  # pragma: no cover
    APIError = Exception
    OpenAI = None


class LLMAnalysisService:
    """Generate analysis text with remote LLMs when enabled."""

    def __init__(self, models_path: str | None = None) -> None:
        self.models_path = Path(models_path or settings.ANALYSIS_MODELS_PATH)
        self.weather_service = WeatherService()

    def generate_analysis_text(
        self,
        records: list[Record],
        range_label: str,
        user_profile_text: str | None = None,
    ) -> str | None:
        if not settings.ANALYSIS_LLM_ENABLED:
            return None

        payload = self._load_models_payload()
        models = self._get_ordered_models(payload)
        if not models:
            return None

        weather_snapshot = self.weather_service.get_current_snapshot()
        prompt = self._build_prompt(records, range_label, weather_snapshot, user_profile_text)
        return self._run_prompt(prompt, payload)

    def generate_summary_text(
        self,
        analysis_texts: list[str],
        range_label: str,
        user_profile_text: str | None = None,
    ) -> str | None:
        if not settings.ANALYSIS_LLM_ENABLED:
            return None

        payload = self._load_models_payload()
        models = self._get_ordered_models(payload)
        if not models:
            return None

        prompt = self._build_summary_prompt(analysis_texts, range_label, user_profile_text)
        return self._run_prompt(prompt, payload)

    def _run_prompt(self, prompt: str, payload: dict[str, Any]) -> str | None:
        models = self._get_ordered_models(payload)
        if not models:
            return None

        for model in models:
            response = self._call_model(model["name"], prompt)
            if response["ok"]:
                return response["content"]

            if self._should_switch_model(response["status_code"]):
                self._switch_model(payload, model["name"], response["status_code"])
                continue

            return None

        return None

    def _call_model(self, model_name: str, prompt: str) -> dict[str, Any]:
        client = self._build_client(model_name)
        if client is None:
            return {"ok": False, "status_code": None, "content": None}

        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "\u4f60\u662f\u4e13\u4e1a\u3001\u514b\u5236\u3001\u6e29\u548c\u7684\u4e2d\u6587"
                            "\u5fc3\u7406\u8bb0\u5f55\u5206\u6790\u52a9\u624b\u3002"
                            "\u53ea\u57fa\u4e8e\u63d0\u4f9b\u7684\u8bb0\u5f55\u505a\u603b\u7ed3\uff0c"
                            "\u4e0d\u865a\u6784\u4e8b\u5b9e\uff0c\u4e0d\u505a\u8bca\u65ad\u3002"
                            "\u8f93\u51fa\u5185\u5bb9\u8981\u6e29\u548c\u3001\u5177\u4f53\u3001\u53ef\u6267\u884c\uff0c"
                            "\u7981\u6b62\u8f93\u51fa\u4f24\u5bb3\u7528\u6237\u6216\u4ed6\u4eba\u7684\u5185\u5bb9\u3002"
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
            )
            content = response.choices[0].message.content if response.choices else ""
            cleaned = (content or "").strip()
            return {"ok": bool(cleaned), "status_code": 200, "content": cleaned or None}
        except APIError as exc:  # type: ignore[misc]
            return {"ok": False, "status_code": getattr(exc, "status_code", None), "content": None}
        except Exception:
            return {"ok": False, "status_code": None, "content": None}

    def _build_client(self, model_name: str) -> OpenAI | None:
        if OpenAI is None:
            return None

        if model_name == settings.DEEPSEEK_MODEL:
            api_key = settings.DEEPSEEK_API_KEY or settings.QWEN_API_KEY
            base_url = settings.DEEPSEEK_BASE_URL or settings.QWEN_BASE_URL
        else:
            api_key = settings.QWEN_API_KEY
            base_url = settings.QWEN_BASE_URL

        if not api_key:
            return None

        return OpenAI(api_key=api_key, base_url=base_url)

    def _load_models_payload(self) -> dict[str, Any]:
        if not self.models_path.exists():
            return {}
        return json.loads(self.models_path.read_text(encoding="utf-8"))

    def _get_ordered_models(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        items = payload.get("models", [])
        models = [item for item in items if isinstance(item, dict) and isinstance(item.get("name"), str)]
        if not models:
            return [{"name": settings.DEEPSEEK_MODEL}] if settings.DEEPSEEK_MODEL else []

        current_index = payload.get("current_model_index", 0)
        if not isinstance(current_index, int) or current_index < 0:
            current_index = 0

        if current_index >= len(models) - 1:
            return [{"name": settings.DEEPSEEK_MODEL}] if settings.DEEPSEEK_MODEL else []

        return models[current_index:]

    def _switch_model(self, payload: dict[str, Any], model_name: str, status_code: int | None) -> None:
        failed_attempts = payload.setdefault("failed_attempts", {})
        failed_attempts[model_name] = {
            "failed_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status_code": status_code,
        }
        change_model(status_code=status_code, models_path=self.models_path)

    @staticmethod
    def _should_switch_model(status_code: int | None) -> bool:
        return isinstance(status_code, int) and 400 <= status_code < 500

    @staticmethod
    def _build_user_profile_context(user_profile_text: str | None) -> str:
        if not user_profile_text:
            return ""

        return "\n".join(
            [
                "\u3010\u7528\u6237\u8d44\u6599\u53c2\u8003\u3011",
                user_profile_text.strip(),
                (
                    "\u4ee5\u4e0a\u4fe1\u606f\u53ea\u80fd\u4f5c\u4e3a\u8f85\u52a9\u7406\u89e3\u7528\u6237"
                    "\u5904\u5883\u7684\u53c2\u8003\u80cc\u666f\uff0c\u53ef\u4ee5\u7528\u6765\u8ba9\u5206\u6790"
                    "\u7ed3\u679c\u548c\u5efa\u8bae\u66f4\u8d34\u8fd1\u7528\u6237\u7684\u5b9e\u9645\u60c5\u51b5\uff0c"
                    "\u4f46\u4e0d\u8981\u56e0\u6027\u522b\u3001\u5e74\u9f84\u6216\u57ce\u5e02\u505a\u523b\u677f"
                    "\u5370\u8c61\u63a8\u65ad\uff0c\u4e5f\u4e0d\u8981\u8d4b\u4e88\u8bb0\u5f55\u4e2d\u6ca1\u6709"
                    "\u7684\u4e8b\u5b9e\u3002"
                ),
            ]
        )

    @staticmethod
    def _build_prompt(
        records: list[Record],
        range_label: str,
        weather_snapshot=None,
        user_profile_text: str | None = None,
    ) -> str:
        ordered = sorted(records, key=lambda item: item.created_at)
        record_blocks = []
        for index, record in enumerate(ordered, start=1):
            record_blocks.append(
                "\n".join(
                    [
                        f"\u8bb0\u5f55{index}",
                        f"\u65f6\u95f4\uff1a{record.created_at.strftime('%Y-%m-%d %H:%M:%S')}",
                        f"\u6807\u9898\uff1a{record.title or '\u672a\u547d\u540d'}",
                        f"\u5185\u5bb9\uff1a{record.content or ''}",
                    ]
                )
            )

        emotion_context = AnalysisSummaryService.build_emotional_context_text(ordered, weather_snapshot)
        user_profile_context = LLMAnalysisService._build_user_profile_context(user_profile_text)
        sections = [
            f"\u5206\u6790\u8303\u56f4\uff1a{range_label}",
            f"\u8bb0\u5f55\u6570\u91cf\uff1a{len(ordered)}",
            (
                "\u8bf7\u57fa\u4e8e\u4e0b\u9762\u8fd9\u4e9b\u8ba4\u77e5-\u60c5\u7eea-\u884c\u4e3a"
                "\u8bb0\u5f55\uff0c\u8f93\u51fa\u4e00\u4efd\u4e2d\u6587\u5206\u6790\u7ed3\u679c\u3002"
            ),
            (
                "\u8bb0\u5f55\u6570\u636e\u5df2\u7ecf\u6309\u65f6\u95f4\u4ece\u65e9\u5230\u665a\u6392\u5217\uff0c"
                "\u8bf7\u7ed3\u5408\u6bcf\u6761\u8bb0\u5f55\u7684\u65f6\u95f4\u548c\u5185\u5bb9\uff0c"
                "\u5206\u6790\u7528\u6237\u72b6\u6001\u968f\u7740\u65f6\u95f4\u6d41\u901d\u7684\u53d8\u5316\u3002"
            ),
        ]
        if user_profile_context:
            sections.append(user_profile_context)
        sections.extend(
            [
                emotion_context,
                "\u8f93\u51fa\u8981\u6c42\uff1a",
                "1. \u7b2c\u4e00\u884c\u5fc5\u987b\u662f\u3010\u5206\u6790\u8303\u56f4\u3011\u52a0\u65f6\u95f4\u8303\u56f4\u3002",
                (
                    "2. \u540e\u7eed\u6309\u4ee5\u4e0b\u6807\u9898\u8f93\u51fa\uff1a\u603b\u4f53\u8d8b\u52bf\u3001"
                    "\u72b6\u6001\u53d8\u5316\u3001\u6bd4\u8f83\u4e25\u91cd\u7684\u95ee\u9898\u6216"
                    "\u9ad8\u9891\u95ee\u9898\u3001\u4e3b\u8981\u89e6\u53d1\u56e0\u7d20\u3001"
                    "\u5df2\u51fa\u73b0\u7684\u6709\u6548\u5e94\u5bf9\u3001\u4e0b\u4e00\u6b65\u5efa\u8bae\u3002"
                ),
                (
                    f"3. \u7b2c\u4e00\u884c\u4e4b\u540e\u7684\u6b63\u6587\u603b\u957f\u5ea6\u63a7\u5236\u5728"
                    f"{settings.ANALYSIS_MAX_LLM_OUTPUT_CHARS}\u5b57\u4ee5\u5185\uff0c"
                    "\u4f46\u4e0d\u8981\u4e3a\u4e86\u538b\u7f29\u5b57\u6570\u7701\u7565\u5173\u952e\u4e8b\u5b9e\u3001"
                    "\u91cd\u8981\u95ee\u9898\u6216\u5fc5\u8981\u5efa\u8bae\u3002"
                ),
                (
                    "4. \u8bb0\u5f55\u6570\u4f1a\u7531\u7cfb\u7edf\u5355\u72ec\u5c55\u793a\uff0c"
                    "\u4f60\u4e0d\u8981\u91cd\u590d\u7edf\u8ba1\u5e73\u5747\u5206\u3001\u8bb0\u5f55\u6570\u3001"
                    "\u9ad8\u9891\u6539\u8fdb\u65b9\u5411\u3001\u9ad8\u9891\u611f\u6069\u7b49\u7ed3\u6784\u5316\u7edf\u8ba1\u9879\u3002"
                ),
                (
                    "5. \u5982\u679c\u63d0\u4f9b\u4e86\u7528\u6237\u6027\u522b\u3001\u5e74\u9f84\u6216\u57ce\u5e02\uff0c"
                    "\u53ef\u4ee5\u9002\u5ea6\u7eb3\u5165\u5206\u6790\uff0c\u8ba9\u5206\u6790\u7ed3\u679c\u548c"
                    "\u5efa\u8bae\u66f4\u8d34\u8fd1\u7528\u6237\u5904\u5883\uff0c\u4f46\u4e0d\u8981\u8fdb\u884c"
                    "\u523b\u677f\u5316\u63a8\u65ad\u3002"
                ),
                (
                    "6. \u8bf7\u4f18\u5148\u6307\u51fa\u6bd4\u8f83\u4e25\u91cd\u7684\u95ee\u9898\uff1b"
                    "\u53ea\u6709\u5f53\u67d0\u7c7b\u95ee\u9898\u3001\u89e6\u53d1\u56e0\u7d20\u6216"
                    "\u8d1f\u5411\u6a21\u5f0f\u5728\u4e0d\u5c11\u4e8e\u4e09\u5206\u4e4b\u4e00\u7684"
                    "\u8bb0\u5f55\u4e2d\u51fa\u73b0\u65f6\uff0c\u624d\u80fd\u660e\u786e\u79f0\u4e3a\u9ad8\u9891\u3002"
                ),
                (
                    "7. \u5982\u679c\u6ca1\u6709\u8fbe\u5230\u4e09\u5206\u4e4b\u4e00\uff0c"
                    "\u4e0d\u8981\u786c\u8bf4\u9ad8\u9891\uff0c\u53ef\u4ee5\u8868\u8ff0\u4e3a\u5076\u53d1\u3001"
                    "\u82e5\u5e72\u6b21\u51fa\u73b0\u6216\u5c40\u90e8\u51fa\u73b0\u3002"
                ),
                (
                    "8. \u4e0d\u8981\u8f93\u51fa markdown \u5217\u8868\u7b26\u53f7\uff0c"
                    "\u4e0d\u8981\u7f16\u9020\u8bb0\u5f55\u91cc\u6ca1\u6709\u7684\u4fe1\u606f\u3002"
                ),
                (
                    "9. \u4e0b\u4e00\u6b65\u5efa\u8bae\u8981\u7b80\u5355\u6613\u4e0a\u624b\u5e76\u4e14"
                    "\u5b9e\u7528\uff0c\u80fd\u591f\u89e3\u51b3\u73b0\u5728\u7684\u95ee\u9898\u3002"
                ),
                "10. \u4e0d\u8981\u8f93\u51fa markdown \u683c\u5f0f\u6587\u6863\u3002",
                "",
                "\u8bb0\u5f55\u6570\u636e\uff1a",
                "\n\n".join(record_blocks),
            ]
        )
        return "\n\n".join(sections)

    @staticmethod
    def _build_summary_prompt(
        analysis_texts: list[str],
        range_label: str,
        user_profile_text: str | None = None,
    ) -> str:
        blocks = []
        for index, analysis_text in enumerate(analysis_texts, start=1):
            blocks.append("\n".join([f"\u5206\u7ec4\u5206\u6790{index}", analysis_text.strip()]))

        user_profile_context = LLMAnalysisService._build_user_profile_context(user_profile_text)
        sections = [
            f"\u5206\u6790\u8303\u56f4\uff1a{range_label}",
            f"\u5206\u7ec4\u6570\u91cf\uff1a{len(analysis_texts)}",
            (
                "\u8bf7\u57fa\u4e8e\u4e0b\u9762\u8fd9\u4e9b\u5206\u7ec4\u5206\u6790\u7ed3\u679c\uff0c"
                "\u8f93\u51fa\u4e00\u4efd\u6700\u7ec8\u6c47\u603b\u5206\u6790\u3002"
            ),
            (
                "\u4e0b\u9762\u7684\u5206\u7ec4\u5206\u6790\u5df2\u6309\u8bb0\u5f55\u521b\u5efa\u65f6\u95f4"
                "\u4ece\u65e9\u5230\u665a\u6392\u5217\uff0c\u8bf7\u4e25\u683c\u6309\u8fd9\u4e2a\u65f6\u95f4\u987a\u5e8f"
                "\u7406\u89e3\u524d\u671f\u3001\u4e2d\u671f\u3001\u540e\u671f\u7684\u53d8\u5316\uff0c"
                "\u4e0d\u8981\u628a\u5206\u7ec4\u987a\u5e8f\u7406\u89e3\u9519\u3002"
            ),
            (
                "\u8bf7\u91cd\u70b9\u5f52\u7eb3\u7528\u6237\u72b6\u6001\u968f\u7740\u65f6\u95f4\u63a8\u8fdb"
                "\u51fa\u73b0\u4e86\u54ea\u4e9b\u53d8\u5316\uff0c\u4ee5\u53ca\u8fd9\u4e9b\u53d8\u5316"
                "\u53ef\u80fd\u548c\u54ea\u4e9b\u89e6\u53d1\u56e0\u7d20\u76f8\u5173\u3002"
            ),
        ]
        if user_profile_context:
            sections.append(user_profile_context)
        sections.extend(
            [
                "\u8f93\u51fa\u8981\u6c42\uff1a",
                (
                    "1. \u7b2c\u4e00\u884c\u5fc5\u987b\u662f\u3010\u5206\u6790\u8303\u56f4\u3011"
                    "\u52a0\u65f6\u95f4\u8303\u56f4\uff0c\u5e76\u5728\u672b\u5c3e\u52a0\uff08\u6c47\u603b\uff09\u3002"
                ),
                (
                    "2. \u540e\u7eed\u6309\u4ee5\u4e0b\u6807\u9898\u8f93\u51fa\uff1a\u603b\u4f53\u8d8b\u52bf\u3001"
                    "\u72b6\u6001\u53d8\u5316\u3001\u6bd4\u8f83\u4e25\u91cd\u7684\u95ee\u9898\u6216"
                    "\u9ad8\u9891\u95ee\u9898\u3001\u4e3b\u8981\u89e6\u53d1\u56e0\u7d20\u3001"
                    "\u5df2\u51fa\u73b0\u7684\u6709\u6548\u5e94\u5bf9\u3001\u4e0b\u4e00\u6b65\u5efa\u8bae\u3002"
                ),
                (
                    f"3. \u7b2c\u4e00\u884c\u4e4b\u540e\u7684\u6b63\u6587\u603b\u957f\u5ea6\u63a7\u5236\u5728"
                    f"{settings.ANALYSIS_MAX_LLM_OUTPUT_CHARS}\u5b57\u4ee5\u5185\uff0c"
                    "\u4f46\u4e0d\u8981\u4e3a\u4e86\u538b\u7f29\u5b57\u6570\u7701\u7565\u5173\u952e\u4e8b\u5b9e\u3001"
                    "\u91cd\u8981\u95ee\u9898\u6216\u5fc5\u8981\u5efa\u8bae\u3002"
                ),
                (
                    "4. \u8bb0\u5f55\u6570\u4f1a\u7531\u7cfb\u7edf\u5355\u72ec\u5c55\u793a\uff0c"
                    "\u4f60\u4e0d\u8981\u91cd\u590d\u7edf\u8ba1\u5e73\u5747\u5206\u3001\u8bb0\u5f55\u6570\u3001"
                    "\u9ad8\u9891\u6539\u8fdb\u65b9\u5411\u3001\u9ad8\u9891\u611f\u6069\u7b49\u7ed3\u6784\u5316\u7edf\u8ba1\u9879\u3002"
                ),
                (
                    "5. \u5982\u679c\u63d0\u4f9b\u4e86\u7528\u6237\u6027\u522b\u3001\u5e74\u9f84\u6216\u57ce\u5e02\uff0c"
                    "\u53ef\u4ee5\u9002\u5ea6\u7eb3\u5165\u6c47\u603b\u5206\u6790\uff0c\u8ba9\u5206\u6790"
                    "\u7ed3\u679c\u548c\u5efa\u8bae\u66f4\u8d34\u8fd1\u7528\u6237\u5904\u5883\uff0c"
                    "\u4f46\u4e0d\u8981\u8fdb\u884c\u523b\u677f\u5316\u63a8\u65ad\u3002"
                ),
                (
                    "6. \u53ea\u6709\u5f53\u67d0\u7c7b\u95ee\u9898\u3001\u89e6\u53d1\u56e0\u7d20\u6216"
                    "\u8d1f\u5411\u6a21\u5f0f\u5728\u4e0d\u5c11\u4e8e\u4e09\u5206\u4e4b\u4e00\u7684"
                    "\u5206\u6790\u6837\u672c\u4e2d\u51fa\u73b0\u65f6\uff0c\u624d\u80fd\u660e\u786e"
                    "\u79f0\u4e3a\u9ad8\u9891\u3002"
                ),
                (
                    "7. \u5982\u679c\u6ca1\u6709\u8fbe\u5230\u4e09\u5206\u4e4b\u4e00\uff0c"
                    "\u4e0d\u8981\u786c\u8bf4\u9ad8\u9891\uff0c\u53ef\u4ee5\u8868\u8ff0\u4e3a\u5076\u53d1\u3001"
                    "\u82e5\u5e72\u6b21\u51fa\u73b0\u6216\u5c40\u90e8\u51fa\u73b0\u3002"
                ),
                (
                    "8. \u4e0d\u8981\u91cd\u590d\u9010\u7ec4\u7f57\u5217\uff0c\u91cd\u70b9\u505a\u8de8\u5206\u7ec4\u5f52\u7eb3\u3002"
                ),
                (
                    "9. \u4e0d\u8981\u8f93\u51fa markdown \u5217\u8868\u7b26\u53f7\uff0c"
                    "\u4e0d\u8981\u7f16\u9020\u8bb0\u5f55\u91cc\u6ca1\u6709\u7684\u4fe1\u606f\u3002"
                ),
                (
                    "10. \u4e0b\u4e00\u6b65\u5efa\u8bae\u8981\u7b80\u5355\u6613\u4e0a\u624b\u5e76\u4e14"
                    "\u5b9e\u7528\uff0c\u80fd\u591f\u89e3\u51b3\u73b0\u5728\u7684\u95ee\u9898\u3002"
                ),
                "11. \u4e0d\u8981\u8f93\u51fa markdown \u683c\u5f0f\u6587\u6863\u3002",
                "",
                "\u5206\u7ec4\u5206\u6790\u6570\u636e\uff1a",
                "\n\n".join(blocks),
            ]
        )
        return "\n\n".join(sections)
