from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """项目所有 ORM 模型共享的声明式基类。"""

    pass
