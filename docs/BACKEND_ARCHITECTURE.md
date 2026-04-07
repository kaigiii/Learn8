# 後端架構

這份文件總覽後端分層與主要 API 模組，作為維護與擴充的快速入口。

後端主幹在 `backend/app/`：

- `api/`: route 與依賴注入
- `core/`: config / security / shared exceptions
- `db/`: SQLAlchemy base / session / registry
- `domain/`: 狀態列舉與共用 domain constants
- `models/`: `user.py`, `course.py`, `lesson.py`, `job.py`
- `schemas/`: auth / course / questionnaire / lesson schemas
- `services/`: ai agents / workers / RAG / commons / workflows

目前實際 endpoint 模組：

- `auth.py`
- `arena.py`
- `arena_admin.py`
- `arena_rank.py`
- `courses.py`
- `syllabus.py`
- `lessons.py`
- `jobs.py`
