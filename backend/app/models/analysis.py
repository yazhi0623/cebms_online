from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Analysis(Base):
    """基于一条或多条记录生成并持久化的分析结果。"""
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_analysis_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    record_id: Mapped[int | None] = mapped_column(ForeignKey("records.id", ondelete="SET NULL"), nullable=True, index=True)
    template_id: Mapped[int | None] = mapped_column(ForeignKey("templates.id", ondelete="SET NULL"), nullable=True, index=True)
    analysis_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="single",
        server_default="single",
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    day_key: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="analyses")
    record = relationship("Record", back_populates="analyses")
    template = relationship("Template", back_populates="analyses")
