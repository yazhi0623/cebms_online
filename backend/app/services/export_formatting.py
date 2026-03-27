from __future__ import annotations

import io
from datetime import date, datetime
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment


FIELD_LABELS = {
    "id": "ID",
    "title": "标题",
    "content": "内容",
    "created_at": "创建时间",
    "updated_at": "更新时间",
    "is_default": "默认模板",
    "template_id": "关联模板ID",
    "record_id": "关联记录ID",
    "day_key": "分析日期",
}

SHEET_TITLES = {
    "records": "记录",
    "templates": "模板",
    "analyses": "分析",
}

TIME_FIELDS = {"created_at", "updated_at"}
DATE_FIELDS = {"day_key"}


def format_display_value(key: str, value: Any) -> Any:
    """把导出值转换成适合给用户阅读的展示格式。"""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, datetime):
        return value.strftime("%Y/%m/%d %H:%M:%S")
    if isinstance(value, date):
        return value.strftime("%Y/%m/%d")
    if isinstance(value, str):
        parsed_datetime = _parse_datetime_string(value) if key in TIME_FIELDS else None
        if parsed_datetime is not None:
            return parsed_datetime.strftime("%Y/%m/%d %H:%M:%S")
        parsed_date = _parse_date_string(value) if key in DATE_FIELDS else None
        if parsed_date is not None:
            return parsed_date.strftime("%Y/%m/%d")
        return value
    return value


def build_display_rows(payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """把原始字段名映射成展示字段名，并统一格式化值。"""
    rows: list[dict[str, Any]] = []
    for item in payload:
        rows.append({FIELD_LABELS.get(key, key): format_display_value(key, value) for key, value in item.items()})
    return rows


def build_display_json_bytes(payload: list[dict[str, Any]]) -> bytes:
    """生成带中文字段名的 JSON 导出内容。"""
    return json_bytes(build_display_rows(payload))


def json_bytes(payload: Any) -> bytes:
    """把任意对象编码成 UTF-8 JSON 字节串。"""
    import json

    return json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")


def build_display_txt(export_type: str, payload: list[dict[str, Any]]) -> bytes:
    """生成适合人工阅读的 TXT 导出内容。"""
    lines: list[str] = []
    item_title = SHEET_TITLES.get(export_type, "项目")
    rows = build_display_rows(payload)

    for index, item in enumerate(rows, start=1):
        lines.append(f"【{item_title}{index}】")
        for label, value in item.items():
            if label == "内容":
                lines.append("内容：")
                lines.append(str(value))
            else:
                lines.append(f"{label}：{value}")
        lines.append("")

    return "\n".join(lines).strip().encode("utf-8")


def build_display_markdown(export_type: str, payload: list[dict[str, Any]]) -> bytes:
    """生成适合人工阅读的 Markdown 导出内容。"""
    sections: list[str] = []
    item_title = SHEET_TITLES.get(export_type, "项目")
    rows = build_display_rows(payload)

    for index, item in enumerate(rows, start=1):
        sections.append(f"## {item_title}{index}\n\n")
        for label, value in item.items():
            if label == "内容":
                sections.append(f"### {label}\n\n{value}\n\n")
            else:
                sections.append(f"- **{label}**：{value}\n")
        sections.append("\n")

    return "".join(sections).encode("utf-8")


def build_display_xlsx_bytes(export_type: str, payload: list[dict[str, Any]]) -> bytes:
    """生成 Excel 导出内容，并设置基础单元格样式。"""
    output = io.BytesIO()
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = SHEET_TITLES.get(export_type, "导出")
    rows = build_display_rows(payload)
    headers = list(rows[0].keys()) if rows else []

    if headers:
        sheet.append(headers)
        for item in rows:
            sheet.append([item.get(header, "") for header in headers])

    alignment = Alignment(vertical="top", wrap_text=True)
    for row in sheet.iter_rows():
        for cell in row:
            cell.alignment = alignment

    _apply_column_widths(sheet)
    workbook.save(output)
    return output.getvalue()


def _apply_column_widths(sheet: Any) -> None:
    """按内容长度估算列宽，避免导出表格过窄。"""
    for column_cells in sheet.columns:
        values = [str(cell.value) for cell in column_cells if cell.value is not None]
        if not values:
            continue
        width = min(max(max(len(value.split("\n")[0]) for value in values) + 2, 10), 36)
        sheet.column_dimensions[column_cells[0].column_letter].width = width


def _parse_datetime_string(value: str) -> datetime | None:
    """尝试把 ISO 时间字符串转成 datetime。"""
    normalized = value.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _parse_date_string(value: str) -> date | None:
    """尝试把 ISO 日期字符串转成 date。"""
    normalized = value.strip()
    try:
        return date.fromisoformat(normalized)
    except ValueError:
        return None
