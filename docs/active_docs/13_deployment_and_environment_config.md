# 🚀 部署指南與環境配置 (Deployment & Environment Config)

本文件說明如何將 Learn8 後端系統部署至生產環境，涵蓋環境變數、Docker 配置以及安全性設定。

---

## 🌟 0. 產品價值與 UX 亮點 (Product Value)

一個穩定的部署環境是「流暢體驗」的底層保障：

- **快速橫向擴展 (Elastic Scalability)**：透過 Docker 容器化技術，當平台用戶激增時，我們可以秒級啟動多個 API 實體，確保每一位學員的生成請求都能被及時處理。
- **全球化的 AI 連線 (Global AI Connectivity)**：環境配置支援多種 LLM 適配器，讓我們能根據區域或性能需求，隨時切換底層 AI 大腦（如 Gemini, GPT 或地端的 LMStudio）。
- **堅固的邊界安全 (Edge Security)**：嚴格的 CORS 策略與 JWT 密鑰管理，確保了學員的學習數據與個人帳戶始終處於加密保護之下。

---

## 🏗️ 1. 環境變數全清單 (.env)

在 `backend/` 根目錄下需建立 `.env` 檔案：

### 1.1 AI 與 API 密鑰
- `GEMINI_API_KEY`: 核心 AI 生成所需的 Google AI Studio 密鑰。
- `LLM_BASE_URL`: (選填) 若使用第三方 Proxy 或地端模型。

### 1.2 資料庫配置
- `DATABASE_URL`: PostgreSQL 連線字串。
- `CHROMA_SERVER_HOST`: 向量數據庫位址。

### 1.3 系統安全性
- `JWT_SECRET_KEY`: JWT 簽名用的隨機字串（切勿外流）。
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Token 有效期（預設 60 分鐘）。

---

## 🐳 2. Docker 容器化部署

### 2.1 Backend Dockerfile 亮點
- 採用多階段構建 (Multi-stage Build) 以縮減映像檔體積。
- 內建 `yt-dlp` 與 `ffmpeg` 依賴，支援 YouTube 影片解析與音訊轉檔。

### 2.2 Docker Compose 啟動指令
```bash
docker-compose up -d --build
```
這將同時啟動：
1. `fastapi-app`: 後端 API 與背景 Worker。
2. `postgres-db`: 關係型數據庫。
3. `chroma-db`: 向量檢索庫。
4. `voxcpm-service`: 語音合成微服務。

---

## 🛡️ 3. 生產環境安全建議

1.  **CORS 限制**：在 `app/main.py` 中，務必將 `allow_origins=["*"]` 修正為正式的前端域名。
2.  **HTTPS 傳輸**：強烈建議在 Nginx 或雲端負載平衡器層級啟用 SSL/TLS。
3.  **磁碟掛載**：確保 `backend/data/` 被掛載至持久化磁碟，防止容器重啟後數據遺失。
