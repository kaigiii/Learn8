# Legacy Frontend Notes

這份文件描述 repo 內的舊版前端：`frontend/`。

## 定位

`frontend/` 已不是目前主要開發中的前端。

目前狀態：

- 仍然存在於 repo 中
- `docker-compose.yml` 目前仍然接它
- 主要用於維持舊啟動流程相容

目前主要開發中的新版前端是：

```text
frontend_new/
```

## 舊前端用途

舊前端主要保留作為：

- 舊版 UI 參考
- compose 啟動入口
- 某些尚未遷移的既有流程備援

## 如果你現在要開發前端

請優先使用：

```bash
cd frontend_new
npm install
npm run dev
```

而不是：

```bash
cd frontend
npm install
npm run dev
```

## 舊前端文件狀態

`frontend/README.md` 內提到的：

- `stage-player`
- `dashboard`
- `ComponentRegistry`
- `component lab`

都屬於舊版結構與舊版命名，不應再視為新版前端的真實架構來源。

## 新舊前端差異

### 新版 `frontend_new/`

- 採 route-owned page modules
- `home / store / questionnaire / auth / course map` 已回到 `src/app/`
- `arena` 作為跨頁 lesson engine 保留在 `src/features/arena`
- stores 已分成 `app / session`

### 舊版 `frontend/`

- 結構仍以舊命名與舊流程為主
- 不代表目前主要產品 UI 的真實狀態

## 建議

- 若只是維護 compose 相容，保留 `frontend/` 即可
- 若未來確定不再依賴舊前端，可再評估是否將 compose 切換到 `frontend_new/`
