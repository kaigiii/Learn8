# Learn8 Frontend

前端是 Learn8 的使用者介面，負責 project workspace、syllabus map、stage player、SSE job 進度呈現與 component lab demo。

## Stack

- Next.js 16
- React 19
- TypeScript
- Zustand
- Tailwind CSS
- Framer Motion
- React Flow

## Development

```bash
cd frontend
npm install
npm run dev
```

預設開在：

```text
http://localhost:3000
```

預設 API base URL：

```text
http://localhost:8000/api/v1
```

可透過環境變數覆蓋：

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Main Areas

- `src/app/page.tsx`: 主工作區與 lesson / remedial SSE 流程
- `src/app/map/page.tsx`: syllabus map 視圖
- `src/features/dashboard/`: project workspace 與 dashboard 元件
- `src/features/course-map/`: node map / drawer
- `src/features/stage-player/`: stage renderer、learning service、interactive components
- `src/components/layout/RightSidebar.tsx`: component lab 入口

## Registered Stage Components

- `MultipleChoice`
- `Ordering`
- `MatchingPairs`
- `FeynmanMirror`

註冊入口：

```text
src/features/stage-player/components/ComponentRegistry.tsx
```

## SSE and Long Jobs

前端會對以下流程訂閱 job stream：

- questionnaire generation
- syllabus generation
- lesson generation
- remedial generation

主要入口：

- `src/lib/jobStream.ts`
- `src/features/stage-player/api/learningService.ts`

## Notes

- `Component Lab` 會用內建 demo stage 直接試玩 component，不依賴真實 project
- 舊 component 名稱若從後端回來，前端會顯示 unsupported fallback，而不是嘗試渲染
