from typing import Protocol, Optional


class FileParser(Protocol):
    def parse(self, file_path: str, max_chars: int = None) -> str:
        """解析檔案並回傳完整文字內容 (受限於 max_chars)。"""
        ...

    async def parse_async(
        self,
        file_path: str,
        max_chars: int = None,
        user_id: int = None,
        project_folder: str = None,
    ) -> str:
        """非同步解析檔案 (用於需要 API 呼叫的解析器)。"""
        ...
