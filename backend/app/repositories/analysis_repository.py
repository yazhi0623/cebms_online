from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.analysis import Analysis
from app.models.record import Record


class AnalysisRepository:
    """封装分析记录以及分析所需源记录的数据库访问。"""
    DELETED_ANALYSIS_CONTENT = "__DELETED_ANALYSIS__"

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> list[Analysis]:
        """返回用于展示的未删除分析记录。"""
        statement = (
            select(Analysis)
            .where(
                Analysis.user_id == user_id,
                Analysis.content != self.DELETED_ANALYSIS_CONTENT,
            )
            .order_by(Analysis.created_at.desc())
        )
        return list(self.db.scalars(statement).all())

    def count_all_by_user(self, user_id: int) -> int:
        statement = select(func.count(Analysis.id)).where(Analysis.user_id == user_id)
        return int(self.db.scalar(statement) or 0)

    def list_by_user_and_day(self, user_id: int, day_key: date) -> list[Analysis]:
        statement = select(Analysis).where(
            Analysis.user_id == user_id,
            Analysis.day_key == day_key,
        )
        return list(self.db.scalars(statement).all())

    def get_by_id_for_user(self, analysis_id: int, user_id: int) -> Analysis | None:
        statement = select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == user_id,
        )
        return self.db.scalar(statement)

    def get_by_source_id_for_user(self, user_id: int, source_analysis_id: int) -> Analysis | None:
        statement = select(Analysis).where(
            Analysis.user_id == user_id,
            Analysis.source_analysis_id == source_analysis_id,
        )
        return self.db.scalar(statement)

    def create(
        self,
        user_id: int,
        record_id: int | None,
        template_id: int | None,
        analysis_type: str,
        content: str,
        day_key: date,
        created_at: datetime | None = None,
        source_analysis_id: int | None = None,
    ) -> Analysis:
        """先插入分析记录，但暂不立即提交事务。"""
        analysis = Analysis(
            user_id=user_id,
            source_analysis_id=source_analysis_id,
            record_id=record_id,
            template_id=template_id,
            analysis_type=analysis_type,
            content=content,
            day_key=day_key,
            created_at=created_at,
        )
        self.db.add(analysis)
        self.db.flush()
        return analysis

    def commit_refresh(self, analysis: Analysis) -> Analysis:
        """提交事务，并刷新刚写入的分析记录。"""
        self.db.commit()
        self.db.refresh(analysis)
        return analysis

    def delete(self, analysis: Analysis) -> None:
        """通过写入墓碑内容实现软删除。"""
        analysis.content = self.DELETED_ANALYSIS_CONTENT
        self.db.add(analysis)
        self.db.commit()

    def get_latest_record_for_user(self, user_id: int) -> Record | None:
        statement = (
            select(Record)
            .where(Record.user_id == user_id)
            .order_by(Record.updated_at.desc(), Record.id.desc())
            .limit(1)
        )
        return self.db.scalar(statement)

    def list_records_for_user(self, user_id: int) -> list[Record]:
        statement = (
            select(Record)
            .where(Record.user_id == user_id)
            .order_by(Record.updated_at.desc())
        )
        return list(self.db.scalars(statement).all())

    def get_record_for_user(self, record_id: int, user_id: int) -> Record | None:
        statement = select(Record).where(
            Record.id == record_id,
            Record.user_id == user_id,
        )
        return self.db.scalar(statement)

    def create_record(self, user_id: int, title: str, content: str) -> Record:
        record = Record(user_id=user_id, title=title, content=content)
        self.db.add(record)
        self.db.flush()
        return record

    def add_record(self, record: Record) -> None:
        self.db.add(record)
