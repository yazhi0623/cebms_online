from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    future=True,
    # 连接池复用前先探活，避免长时间运行后拿到失效连接。
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=Session,
)


def get_db() -> Generator[Session, None, None]:
    """为每个请求提供一个数据库会话，并在结束后关闭。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
