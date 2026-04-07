# 前端架構

這份文件快速描述前端的分層與主要模組位置，方便新同事或外部協作快速定位。

前端目前採用這個分層：

- `src/app/`: route-owned page modules
- `src/components/`: shared UI
- `src/features/`: 跨 route 的完整業務模組
- `src/lib/`: auth / jobs / navigation / API helpers
- `src/stores/app/`: app-global state
- `src/stores/session/`: flow/session state

## 目前主要 page modules

- `src/app/(dashboard)/home/`
- `src/app/(dashboard)/store/`
- `src/app/auth/login/`
- `src/app/auth/welcome/`
- `src/app/courses/[courseId]/`
- `src/app/questionnaire/`

## 目前保留在 `features/` 的模組

- `src/features/lesson-session/`: lesson player / stage renderer / remedial flow
- `src/features/profile/`: shared profile settings dialog
- `src/features/questionnaire/`: questionnaire flow hooks
