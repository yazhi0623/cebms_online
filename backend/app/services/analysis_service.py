from datetime import date

from fastapi import HTTPException, status

from app.core.config import settings
from app.models.analysis import Analysis
from app.models.user import User
from app.repositories.analysis_repository import AnalysisRepository
from app.repositories.template_repository import TemplateRepository
from app.schemas.analysis import AnalysisCreate, AnalysisGenerateRequest
from app.services.analysis_summary_service import AnalysisSummaryService
from app.services.llm_analysis_service import LLMAnalysisService
from app.services.weather_service import WeatherService


class AnalysisService:
    """处理分析的生成、聚合和删除。"""
    BATCH_SIZE = 30

    def __init__(
        self,
        analysis_repository: AnalysisRepository,
        template_repository: TemplateRepository,
        llm_analysis_service: LLMAnalysisService | None = None,
    ) -> None:
        self.analysis_repository = analysis_repository
        self.template_repository = template_repository
        self.llm_analysis_service = llm_analysis_service or LLMAnalysisService()
        self.weather_service = WeatherService()

    def list_analyses(self, user_id: int) -> list[Analysis]:
        """返回当前用户已保存的分析结果。"""
        return self.analysis_repository.list_by_user(user_id)

    def aggregate_analyses(self, user_id: int) -> dict[str, str | int]:
        """构建分析页概览区域需要的聚合结果。"""
        analyses = self.list_analyses(user_id)
        total_count = self.analysis_repository.count_all_by_user(user_id)
        if not analyses:
            return {
                "count": 0,
                "content": "暂无已保存的AI分析结果",
                "total_count": total_count,
                "latest_day": None,
                "combined_content": "暂无已保存的AI分析结果",
            }

        content = "\n\n".join(
            [f"AI分析结果：{item.created_at.strftime('%Y-%m-%d %H:%M')}\n{item.content}" for item in analyses]
        )
        latest_day = max(item.day_key.isoformat() for item in analyses)
        return {
            "count": len(analyses),
            "content": content,
            "total_count": total_count,
            "latest_day": latest_day,
            "combined_content": content,
        }

    def today_analysis_count(self, user_id: int) -> dict[str, int | str | bool]:
        """返回当前日期的分析次数和配额信息。"""
        today = date.today()
        count = len(self.analysis_repository.list_by_user_and_day(user_id, today))
        daily_limit = self._get_daily_limit()
        return {
            "day_key": today.isoformat(),
            "count": count,
            "limit": daily_limit,
            "threshold": settings.ANALYSIS_THRESHOLD,
            "llm_enabled": settings.ANALYSIS_LLM_ENABLED,
        }

    def generate_analysis(self, user_id: int, payload: AnalysisGenerateRequest, current_user: User | None = None) -> Analysis:
        """在给定时间范围内生成分析结果。

        这里会先校验记录数量门槛和每日次数限制，再决定走单次分析还是分批分析。
        """
        records = self.analysis_repository.list_records_for_user(user_id)
        template = None
        range_label = AnalysisSummaryService.range_label(payload.range_months)

        if payload.template_id is not None:
            template = self.template_repository.get_by_id_for_user(payload.template_id, user_id)
            if template is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
            records = [record for record in records if record.template_id == template.id]
            range_label = f"模板：{template.title}"
        else:
            records = self._filter_records_by_range(records, payload.range_months)

        if len(records) < settings.ANALYSIS_THRESHOLD:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"At least {settings.ANALYSIS_THRESHOLD} records are required for analysis",
            )

        day_key = date.today()
        self._ensure_daily_limit(user_id, day_key)
        if len(records) > self.BATCH_SIZE:
            return self._generate_batched_analysis(
                user_id,
                payload.record_id,
                payload.template_id,
                records,
                range_label,
                day_key,
                current_user,
            )

        return self._generate_single_analysis(
            user_id,
            payload.record_id,
            payload.template_id,
            records,
            range_label,
            day_key,
            current_user,
        )

    def _generate_single_analysis(
        self,
        user_id: int,
        record_id: int | None,
        template_id: int | None,
        records,
        range_label: str,
        day_key: date,
        current_user: User | None = None,
    ) -> Analysis:
        """直接基于过滤后的记录集合生成一次分析。"""
        summary_content = self._with_range_label(self._build_analysis_text(records, 0), range_label)
        user_profile_text = self._build_user_profile_text(current_user)
        content = self.llm_analysis_service.generate_analysis_text(records, range_label, user_profile_text)
        if not content:
            content = summary_content
        else:
            content = self._normalize_analysis_content(content, range_label)
            content = self._merge_summary_with_llm_content(summary_content, content)
        content = self._append_required_emotional_guidance(content, records)
        analysis_in = AnalysisCreate(
            record_id=record_id,
            template_id=template_id,
            analysis_type="single",
            content=content,
            day_key=day_key,
        )
        return self._create_analysis_unchecked(user_id, analysis_in)

    def _generate_batched_analysis(
        self,
        user_id: int,
        record_id: int | None,
        template_id: int | None,
        records,
        range_label: str,
        day_key: date,
        current_user: User | None = None,
    ) -> Analysis:
        """先分块生成，再对分块结果做最终汇总。"""
        chunks = self._chunk_records(records, self.BATCH_SIZE)
        chunk_analyses: list[Analysis] = []
        total_chunks = len(chunks)

        for index, chunk in enumerate(chunks, start=1):
            chunk_label = f"{range_label}（第{index}/{total_chunks}组）"
            chunk_summary = self._with_range_label(self._build_analysis_text(chunk, 0), chunk_label)
            user_profile_text = self._build_user_profile_text(current_user)
            chunk_content = self.llm_analysis_service.generate_analysis_text(chunk, chunk_label, user_profile_text)
            if not chunk_content:
                chunk_content = chunk_summary
            else:
                chunk_content = self._normalize_analysis_content(chunk_content, chunk_label)
                chunk_content = self._merge_summary_with_llm_content(chunk_summary, chunk_content)
            chunk_content = self._append_required_emotional_guidance(chunk_content, chunk)

            chunk_analysis = self._create_analysis_unchecked(
                user_id,
                AnalysisCreate(
                    record_id=record_id,
                    template_id=template_id,
                    analysis_type="batch_chunk",
                    content=chunk_content,
                    day_key=day_key,
                ),
            )
            chunk_analyses.append(chunk_analysis)

        final_label = f"{range_label}（汇总）"
        final_summary = self._with_range_label(self._build_analysis_text(records, 0), final_label)
        final_content = self.llm_analysis_service.generate_summary_text(
            [analysis.content for analysis in chunk_analyses],
            final_label,
            self._build_user_profile_text(current_user),
        )
        if not final_content:
            final_content = final_summary
        else:
            final_content = self._normalize_analysis_content(final_content, final_label)
            final_content = self._merge_summary_with_llm_content(final_summary, final_content)
        final_content = self._append_required_emotional_guidance(final_content, records)

        return self._create_analysis_unchecked(
            user_id,
            AnalysisCreate(
                record_id=record_id,
                template_id=template_id,
                analysis_type="batch_summary",
                content=final_content,
                day_key=day_key,
            ),
        )

    def create_analysis(self, user_id: int, analysis_in: AnalysisCreate) -> Analysis:
        if analysis_in.record_id is not None:
            record = self.analysis_repository.get_record_for_user(analysis_in.record_id, user_id)
            if record is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
        if analysis_in.template_id is not None:
            template = self.template_repository.get_by_id_for_user(analysis_in.template_id, user_id)
            if template is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

        self._ensure_daily_limit(user_id, analysis_in.day_key)
        return self._create_analysis_unchecked(user_id, analysis_in)

    def delete_analysis(self, analysis_id: int, user_id: int) -> None:
        analysis = self.analysis_repository.get_by_id_for_user(analysis_id, user_id)
        if analysis is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
        self.analysis_repository.delete(analysis)

    def _filter_records_by_range(self, records, range_months: int):
        return AnalysisSummaryService.filter_records_by_range(records, range_months)

    def _build_analysis_text(self, records, range_months: int = 0) -> str:
        return AnalysisSummaryService.build_summary_text(records, range_months)

    def _ensure_daily_limit(self, user_id: int, day_key: date) -> None:
        """执行按天的分析次数限制校验。"""
        today_count = len(self.analysis_repository.list_by_user_and_day(user_id, day_key))
        daily_limit = self._get_daily_limit()
        if today_count >= daily_limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Daily analysis limit reached ({daily_limit})",
            )

    @staticmethod
    def _get_daily_limit() -> int:
        if settings.ANALYSIS_LLM_ENABLED:
            return settings.DAILY_ANALYSIS_LIMIT
        return settings.DAILY_ANALYSIS_LIMIT_WHEN_LLM_DISABLED

    def _create_analysis_unchecked(self, user_id: int, analysis_in: AnalysisCreate) -> Analysis:
        analysis = self.analysis_repository.create(
            user_id=user_id,
            record_id=analysis_in.record_id,
            template_id=analysis_in.template_id,
            analysis_type=analysis_in.analysis_type,
            content=analysis_in.content,
            day_key=analysis_in.day_key,
        )
        return self.analysis_repository.commit_refresh(analysis)

    @staticmethod
    def _chunk_records(records, batch_size: int) -> list[list]:
        return [records[index : index + batch_size] for index in range(0, len(records), batch_size)]

    @staticmethod
    def _with_range_label(content: str, range_label: str) -> str:
        expected_title = f"【分析范围】{range_label}"
        lines = (content or "").splitlines()
        if not lines:
            return expected_title
        lines[0] = expected_title
        return "\n".join(lines)

    @staticmethod
    def _normalize_analysis_content(content: str, range_label: str) -> str:
        expected_title = f"【分析范围】{range_label}"
        lines = [line.rstrip() for line in (content or "").splitlines()]
        while lines and not lines[0].strip():
            lines.pop(0)

        if not lines:
            return expected_title

        if lines[0].strip() == expected_title:
            return "\n".join(lines)

        if lines[0].strip().startswith("【分析范围】"):
            lines[0] = expected_title
            return "\n".join(lines)

        return "\n".join([expected_title, "", *lines]).strip()

    @staticmethod
    def _merge_summary_with_llm_content(summary_content: str, llm_content: str) -> str:
        summary_lines = summary_content.splitlines()
        llm_lines = llm_content.splitlines()
        merged_lines = [summary_lines[0], *summary_lines[1:], "", "AI分析：", *llm_lines[1:]]
        return "\n".join(line for line in merged_lines if line is not None).strip()

    def _append_required_emotional_guidance(self, content: str, records) -> str:
        guidance_lines = self._build_required_emotional_guidance(records)
        if not guidance_lines:
            return content

        missing_lines = [line for line in guidance_lines if line not in content]
        if not missing_lines:
            return content

        if "下一步建议：" in content:
            return f"{content}\n" + "\n".join(missing_lines)

        return f"{content}\n\n下一步建议：\n" + "\n".join(missing_lines)

    @staticmethod
    def _build_user_profile_text(current_user: User | None) -> str | None:
        if current_user is None:
            return None

        lines = []
        gender = (current_user.gender or "").strip()
        if gender in {"男", "女"}:
            lines.append(f"\u6027\u522b\uff1a{gender}")
        if current_user.age is not None:
            lines.append(f"\u5e74\u9f84\uff1a{current_user.age}")
        if (current_user.city or "").strip():
            lines.append(f"\u57ce\u5e02\uff1a{current_user.city.strip()}")

        if not lines:
            return None

        lines.append(
            "\u8bf7\u5728\u5206\u6790\u548c\u5efa\u8bae\u91cc\u53c2\u8003\u8fd9\u4e9b\u80cc\u666f\u4fe1\u606f\uff0c\u4f46\u4e0d\u8981\u523b\u677f\u5370\u8c61\u6216\u8fc7\u5ea6\u63a8\u65ad\u3002"
        )
        return "\n".join(lines)

    def _build_required_emotional_guidance(self, records) -> list[str]:
        if not records:
            return []

        today = date.today()
        ordered = sorted(records, key=lambda item: (item.created_at, item.id))
        today_records = [record for record in ordered if record.created_at.date() == today]
        latest_record = ordered[-1]
        today_scores = [
            score
            for score in (AnalysisSummaryService._extract_emotion_score(record.content) for record in today_records)
            if score is not None
        ]
        latest_score = AnalysisSummaryService._extract_emotion_score(latest_record.content)
        latest_has_crisis_keywords = AnalysisSummaryService._contains_crisis_keywords(latest_record.content)
        is_crisis = bool(today_scores and min(today_scores) <= 2) or latest_has_crisis_keywords
        is_low_energy = not is_crisis and latest_score is not None and 3 <= latest_score <= 6
        has_two_week_low_streak = AnalysisSummaryService._has_two_week_low_mood_streak(records, today)

        guidance_lines: list[str] = []
        if is_crisis:
            guidance_lines.append("请先休息，今天先只保留吃饭、喝水、洗漱和睡觉这些最基本的事。")
            weather_snapshot = self.weather_service.get_current_snapshot()
            if weather_snapshot and weather_snapshot.is_sunny and weather_snapshot.is_daylight:
                guidance_lines.append("如果现在天气晴好且还没日落，可以去阳光下待10到15分钟，只是晒晒太阳就可以。")
        elif is_low_energy:
            guidance_lines.append("先不要给自己安排太多任务，今天只保留一件最重要的小事，完成就可以。")
            guidance_lines.append("最小一步可以只是坐起来、喝一口水，或者把要做的事写成一行。")

        if has_two_week_low_streak:
            guidance_lines.append("如果这种低落状态已经连续两周都没有缓解，建议尽快线下就医，或联系专业心理咨询/精神科帮助。")

        return guidance_lines
