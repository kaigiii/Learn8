"""
模組名稱: app.db.base_class
功能描述: ORM 基底類別 (Declarative Base)

定義了所有 SQLAlchemy Model 的基底類別 `Base`。
此類別使用了 `as_declarative` 裝飾器，並實作了自動生成資料表名稱的邏輯。

主要類別:
    - Base: 所有 Model 都繼承此類別。

功能:
    1. id: 預留 id 欄位 (雖然實際定義通常在子類別)。
    2. __tablename__: 自動將 ClassName (駝峰式) 轉換為小寫複數的資料表名稱。
       例如: `UserModel` -> `users` (而非 user_model)。
"""

from typing import Any
from sqlalchemy.ext.declarative import as_declarative, declared_attr

@as_declarative()
class Base:
    id: Any
    __name__: str

    # Generate __tablename__ automatically
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower() + "s"
