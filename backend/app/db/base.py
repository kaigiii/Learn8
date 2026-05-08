from typing import Any, TYPE_CHECKING

from sqlalchemy.orm import as_declarative, declared_attr


@as_declarative()
class Base:
    id: Any
    __name__: str

    if TYPE_CHECKING:
        def __init__(self, **kwargs: Any) -> None: ...

    # 自動產生 __tablename__
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower() + "s"
