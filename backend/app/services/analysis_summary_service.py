from __future__ import annotations

from datetime import date, timedelta

from app.models.record import Record
from app.services.weather_service import WeatherSnapshot


class AnalysisSummaryService:
    """Provide analysis summaries and emotion-aware prompt context."""

    RANGE_LABELS = {
        1: "前一个月",
        3: "前三个月",
        6: "前六个月",
        12: "前一年",
        0: "全部",
    }

    FIELD_MAPPING = {
        "情绪分值(1~10)": "emotionScore",
        "天气": "weather",
        "睡眠": "sleep",
        "运动": "exercise",
        "三餐": "meals",
        "做了什么": "didWhat",
        "遇到了什么问题": "problem",
        "解决方法": "solution",
        "感恩": "gratitude",
        "需要改进": "improvement",
        "其他": "other",
    }

    CRISIS_KEYWORDS = ("好烦", "不想动", "自杀", "不想活", "结束生命", "活着没意思")

    @classmethod
    def parse_content_fields(cls, content: str) -> dict[str, str]:
        result = {
            "emotionScore": "",
            "weather": "",
            "sleep": "",
            "exercise": "",
            "meals": "",
            "didWhat": "",
            "problem": "",
            "solution": "",
            "gratitude": "",
            "improvement": "",
            "other": "",
        }

        for raw_line in (content or "").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            if "：" in line:
                left, right = line.split("：", 1)
            elif ":" in line:
                left, right = line.split(":", 1)
            else:
                continue
            mapped = cls.FIELD_MAPPING.get(left.strip())
            if mapped:
                result[mapped] = right.strip()

        return result

    @classmethod
    def range_label(cls, range_months: int) -> str:
        return cls.RANGE_LABELS.get(range_months, cls.RANGE_LABELS[0])

    @staticmethod
    def subtract_months(value: date, months: int) -> date:
        year = value.year
        month = value.month - months
        while month <= 0:
            month += 12
            year -= 1

        day = min(value.day, AnalysisSummaryService.days_in_month(year, month))
        return date(year, month, day)

    @staticmethod
    def days_in_month(year: int, month: int) -> int:
        if month == 2:
            is_leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
            return 29 if is_leap else 28
        if month in {4, 6, 9, 11}:
            return 30
        return 31

    @classmethod
    def filter_records_by_range(cls, records: list[Record], range_months: int) -> list[Record]:
        if range_months <= 0:
            return records

        start_date = cls.subtract_months(date.today(), range_months)
        return [record for record in records if record.created_at.date() >= start_date]

    @classmethod
    def build_summary_text(cls, records: list[Record], range_months: int = 0) -> str:
        ordered = sorted(records, key=lambda item: item.created_at, reverse=True)
        parsed = [cls.parse_content_fields(record.content) for record in ordered]
        record_count = len(ordered)

        scores: list[float] = []
        for item in parsed:
            raw = item.get("emotionScore", "").strip()
            if not raw:
                continue
            try:
                scores.append(float(raw))
            except (TypeError, ValueError):
                continue

        average = f"{sum(scores) / len(scores):.1f}" if scores else "暂无"

        def frequency(key: str) -> str:
            counter: dict[str, int] = {}
            for item in parsed:
                value = item.get(key, "").strip()
                if value:
                    counter[value] = counter.get(value, 0) + 1
            if not counter:
                return "暂无明显集中项"
            pairs = sorted(counter.items(), key=lambda pair: pair[1], reverse=True)[:3]
            return "、".join(f"{value}({count})" for value, count in pairs)

        return "\n".join(
            [
                f"【分析范围】{cls.range_label(range_months)}",
                f"本次纳入分析的记录数：{record_count} 条",
                f"平均情绪分值：{average}",
                f"高频问题：{frequency('problem')}",
                f"高频改进方向：{frequency('improvement')}",
                f"高频感恩内容：{frequency('gratitude')}",
                "建议：优先对高频问题和高频改进方向建立一一对应的行动清单，下次记录时重点观察情绪分值是否随行动而变化。",
            ]
        )

    @classmethod
    def _extract_emotion_score(cls, content: str) -> float | None:
        fields = cls.parse_content_fields(content)
        raw = fields.get("emotionScore", "").strip()
        if not raw:
            return None
        try:
            return float(raw)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _contains_crisis_keywords(cls, content: str) -> bool:
        text = (content or "").strip()
        return any(keyword in text for keyword in cls.CRISIS_KEYWORDS)

    @classmethod
    def _has_two_week_low_mood_streak(cls, records: list[Record], analysis_day: date) -> bool:
        daily_scores: dict[date, list[float]] = {}
        for record in records:
            score = cls._extract_emotion_score(record.content)
            if score is None:
                continue
            daily_scores.setdefault(record.created_at.date(), []).append(score)

        for offset in range(1, 15):
            current_day = analysis_day - timedelta(days=offset)
            scores = daily_scores.get(current_day)
            if not scores:
                return False
            if any(score >= 3 for score in scores):
                return False
        return True

    @classmethod
    def build_emotional_context_text(
        cls,
        records: list[Record],
        weather_snapshot: WeatherSnapshot | None = None,
        analysis_day: date | None = None,
    ) -> str:
        if not records:
            return ""

        current_day = analysis_day or date.today()
        ordered = sorted(records, key=lambda item: (item.created_at, item.id))
        today_records = [record for record in ordered if record.created_at.date() == current_day]
        latest_record = ordered[-1]
        latest_score = cls._extract_emotion_score(latest_record.content)
        today_scores = [
            score for score in (cls._extract_emotion_score(record.content) for record in today_records) if score is not None
        ]
        latest_has_crisis_keywords = cls._contains_crisis_keywords(latest_record.content)
        is_crisis = bool(today_scores and min(today_scores) <= 2) or latest_has_crisis_keywords
        is_low_energy = not is_crisis and latest_score is not None and 3 <= latest_score <= 6
        has_two_week_low_streak = cls._has_two_week_low_mood_streak(records, current_day)

        today_score_text = ", ".join(
            str(int(score)) if float(score).is_integer() else f"{score:.1f}" for score in today_scores
        ) or "无"

        lines = [
            "【情绪状态识别规则】",
            "请优先关注当天记录，再结合更长时间范围做判断。",
            f"分析日期：{current_day.isoformat()}",
            f"当天记录数：{len(today_records)}",
            f"当天可解析情绪分值：{today_score_text}",
            f"最新一条记录是否出现崩溃关键词：{'是' if latest_has_crisis_keywords else '否'}",
        ]

        if is_crisis:
            lines.extend(
                [
                    "当前状态判定：用户处于情绪崩溃状态。",
                    "建议要求：必须明确给出休息建议，语气温和、直接、可执行。",
                ]
            )
            if weather_snapshot and weather_snapshot.is_sunny and weather_snapshot.is_daylight:
                lines.append(
                    f"天气条件：{weather_snapshot.location_label} 当前天气晴好且太阳未落山，请额外补充晒太阳建议。"
                )
            else:
                lines.append("天气条件：当前没有满足晴好且白天的条件，不要补充晒太阳建议，只保留休息建议。")
        elif is_low_energy:
            lines.extend(
                [
                    "当前状态判定：用户处于低能量状态。",
                    "建议要求：在整体建议之外，必须拆出一个用户几乎不费力就能做到的最小一步。",
                ]
            )
        else:
            lines.append("当前状态判定：没有触发崩溃或低能量特殊规则，正常分析即可。")

        if has_two_week_low_streak:
            lines.append("连续两周低落提醒：分析日前连续14个自然日情绪分值都低于3，请明确给出就医或寻求专业心理帮助的建议。")
        else:
            lines.append("连续两周低落提醒：未满足连续两周自然日情绪分值都低于3的条件，不需要主动加入就医建议。")

        lines.extend(
            [
                "注意：没有情绪表达的记录不要强行推断情绪分值，只基于文本内容正常分析。",
                "注意：不要输出诊断结论，不要夸大风险，但在触发规则时要明确说明支持性建议。",
            ]
        )

        return "\n".join(lines)
