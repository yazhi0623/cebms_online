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

    def generate_analysis_text(self, records: list[Record], range_label: str) -> str | None:
        if not settings.ANALYSIS_LLM_ENABLED:
            return None

        payload = self._load_models_payload()
        models = self._get_ordered_models(payload)
        if not models:
            return None

        weather_snapshot = self.weather_service.get_current_snapshot()
        prompt = self._build_prompt(records, range_label, weather_snapshot)
        return self._run_prompt(prompt, payload)

    def generate_summary_text(self, analysis_texts: list[str], range_label: str) -> str | None:
        if not settings.ANALYSIS_LLM_ENABLED:
            return None

        payload = self._load_models_payload()
        models = self._get_ordered_models(payload)
        if not models:
            return None

        prompt = self._build_summary_prompt(analysis_texts, range_label)
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
                            "你是专业、克制、温和的中文心理记录分析助手。"
                            "只基于提供的记录做总结，不虚构事实，不做诊断。"
                            "输出内容要温和、具体、可执行，禁止输出伤害用户或他人的内容。"
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
    def _build_prompt(records: list[Record], range_label: str, weather_snapshot=None) -> str:
        ordered = sorted(records, key=lambda item: item.created_at)
        record_blocks = []
        for index, record in enumerate(ordered, start=1):
            record_blocks.append(
                "\n".join(
                    [
                        f"记录{index}",
                        f"时间：{record.created_at.strftime('%Y-%m-%d %H:%M:%S')}",
                        f"标题：{record.title or '未命名'}",
                        f"内容：{record.content or ''}",
                    ]
                )
            )

        emotion_context = AnalysisSummaryService.build_emotional_context_text(ordered, weather_snapshot)

        return "\n\n".join(
            [
                f"分析范围：{range_label}",
                f"记录数量：{len(ordered)}",
                "请基于下面这些认知-情绪-行为记录，输出一份中文分析结果。",
                "记录数据已经按时间从早到晚排列，请结合每条记录的时间和内容，分析用户状态随着时间流逝的变化。",
                emotion_context,
                "输出要求：",
                "1. 第一行必须是【分析范围】加时间范围。",
                "2. 后续按以下标题输出：总体趋势、状态变化、比较严重的问题或高频问题、主要触发因素、已出现的有效应对、下一步建议。",
                f"3. 第一行之后的正文总长度控制在{settings.ANALYSIS_MAX_LLM_OUTPUT_CHARS}字以内，但不要为了压缩字数省略关键事实、重要问题或必要建议。",
                "4. 记录数会由系统单独展示，你不要重复统计平均分、记录数、高频改进方向、高频感恩等结构化统计项。",
                "5. 请优先指出比较严重的问题；只有当某类问题、触发因素或负向模式在不少于三分之一的记录中出现时，才能明确称为高频。",
                "6. 如果没有达到三分之一，不要硬说高频，可以表述为偶发、若干次出现或局部出现。",
                "7. 不要输出 markdown 列表符号，不要编造记录里没有的信息。",
                "8. 下一步建议要简单易上手并且实用能够解决现在的问题。",
                "9. 不要输出 markdown 格式文档。",
                "",
                "记录数据：",
                "\n\n".join(record_blocks),
            ]
        )

    @staticmethod
    def _build_summary_prompt(analysis_texts: list[str], range_label: str) -> str:
        blocks = []
        for index, analysis_text in enumerate(analysis_texts, start=1):
            blocks.append("\n".join([f"分组分析{index}", analysis_text.strip()]))

        return "\n\n".join(
            [
                f"分析范围：{range_label}",
                f"分组数量：{len(analysis_texts)}",
                "请基于下面这些分组分析结果，输出一份最终汇总分析。",
                "请重点归纳用户状态随着时间推进出现了哪些变化，以及这些变化可能和哪些触发因素相关。",
                "输出要求：",
                "1. 第一行必须是【分析范围】加时间范围，并在末尾加（汇总）。",
                "2. 后续按以下标题输出：总体趋势、状态变化、比较严重的问题或高频问题、主要触发因素、已出现的有效应对、下一步建议。",
                f"3. 第一行之后的正文总长度控制在{settings.ANALYSIS_MAX_LLM_OUTPUT_CHARS}字以内，但不要为了压缩字数省略关键事实、重要问题或必要建议。",
                "4. 记录数会由系统单独展示，你不要重复统计平均分、记录数、高频改进方向、高频感恩等结构化统计项。",
                "5. 只有当某类问题、触发因素或负向模式在不少于三分之一的分析样本中出现时，才能明确称为高频。",
                "6. 如果没有达到三分之一，不要硬说高频，可以表述为偶发、若干次出现或局部出现。",
                "7. 不要重复逐组罗列，重点做跨分组归纳。",
                "8. 不要输出 markdown 列表符号，不要编造记录里没有的信息。",
                "9. 下一步建议要简单易上手并且实用能够解决现在的问题。",
                "10. 不要输出 markdown 格式文档。",
                "",
                "分组分析数据：",
                "\n\n".join(blocks),
            ]
        )
