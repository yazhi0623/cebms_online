from __future__ import annotations

from datetime import date

from app.models.record import Record


class AnalysisSummaryService:
    """提供批量分析前的文本摘要和时间范围工具。"""

    RANGE_LABELS = {
        1: "前一个月",
        3: "前三个月",
        6: "前六个月",
        12: "前一年",
        0: "全部",
    }

    @staticmethod
    def parse_content_fields(content: str) -> dict[str, str]:
        """把记录正文里的结构化字段拆成键值对。"""
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

        mapping = {
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

        for raw_line in (content or "").splitlines():
            if "：" in raw_line:
                left, right = raw_line.split("：", 1)
            elif ":" in raw_line:
                left, right = raw_line.split(":", 1)
            else:
                continue
            mapped = mapping.get(left.strip())
            if mapped:
                result[mapped] = right.strip()

        return result

    @classmethod
    def range_label(cls, range_months: int) -> str:
        """把月份范围转成人类可读标签。"""
        return cls.RANGE_LABELS.get(range_months, cls.RANGE_LABELS[0])

    @staticmethod
    def subtract_months(value: date, months: int) -> date:
        """从某个日期回退指定月数，处理跨年和月底对齐。"""
        year = value.year
        month = value.month - months
        while month <= 0:
            month += 12
            year -= 1

        day = min(value.day, AnalysisSummaryService.days_in_month(year, month))
        return date(year, month, day)

    @staticmethod
    def days_in_month(year: int, month: int) -> int:
        """返回某年某月的天数。"""
        if month == 2:
            is_leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
            return 29 if is_leap else 28
        if month in {4, 6, 9, 11}:
            return 30
        return 31

    @classmethod
    def filter_records_by_range(cls, records: list[Record], range_months: int) -> list[Record]:
        """按时间范围筛选记录，供批量分析入口复用。"""
        if range_months <= 0:
            return records

        start_date = cls.subtract_months(date.today(), range_months)
        return [record for record in records if record.updated_at.date() >= start_date]

    @classmethod
    def build_summary_text(cls, records: list[Record], range_months: int = 0) -> str:
        """基于多条记录生成批量分析前的摘要文本。"""
        ordered = sorted(records, key=lambda item: item.updated_at, reverse=True)
        parsed = [cls.parse_content_fields(record.content) for record in ordered]
        record_count = len(ordered)

        scores = []
        for item in parsed:
            try:
                scores.append(float(item["emotionScore"]))
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

        return "\n".join([
            f"【分析范围】{cls.range_label(range_months)}",
            f"本次纳入分析的记录数：{record_count} 条",
            f"平均情绪分值：{average}",
            f"高频问题：{frequency('problem')}",
            f"高频改进方向：{frequency('improvement')}",
            f"高频感恩内容：{frequency('gratitude')}",
            "建议：优先对高频问题与高频改进方向建立一一对应的行动清单，下次记录时重点观察情绪分值是否随行动而变化。",
        ])
