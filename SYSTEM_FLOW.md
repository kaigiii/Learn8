# Learna v3 - 系統運作流程

## 1. 內容輸入與處理 (Content Ingestion)
使用者上傳教科書 PDF 檔案
⬇
**後端接收 (Backend)**: `POST /upload-pdf`
⬇
**檔案服務 (FileService)**: 將原始檔案儲存至伺服器硬碟 (`uploads/`)
⬇
**重置串流 (Stream Reset)**: 系統將讀取指標歸零 (`seek(0)`)，確保後續可讀取
⬇
**RAG 引擎 (如果啟用)**: 讀取檔案內容 -> 切割文字 (Chunking) -> 轉向量 (Embedding) -> 存入資料庫

## 2. 課程大綱生成 (Syllabus Architecture)
使用者輸入學習主題 (例如: "線性代數")
⬇
**後端接收**: `POST /generate-syllabus`
⬇
**LLM 提示工程**: 組合系統提示詞 (`app.core.prompts`) 與使用者主題
⬇
**AI 生成**: LLM 回傳嚴格結構化的 JSON大綱 (單元 -> 節點)
⬇
**圖形解析**: 系統將 JSON 轉換為學習路徑圖 (Graph) 並存入資料庫

## 3. 單元課程生成 (Just-in-Time Generation)
使用者點擊學習節點 ("開始學習")
⬇
**快取檢查**: 系統檢查資料庫是否已有該節點的課程內容
⬇
**(如果無快取) AI 生成**:
1.  **架構選擇**: 決定教學元件 (文字排序、配對遊戲、圖像解說等)
2.  **嚴格驗證**: 使用 Pydantic Union 確保生成的 JSON 格式 100% 正確
⬇
**前端渲染**: 根據 `ComponentRegistry` 動態載入對應的互動元件 (React)

## 4. 互動學習與提交 (Interaction & Submission)
使用者完成互動 (排序、連連看) 並點擊 "送出"
⬇
**後端接收**: `POST /submit-answer`
⬇
**數據記錄 (Analytics)**:
*   記錄使用者 ID
*   記錄作答內容與正確性 (True/False)
*   存入 `lesson_attempts` 資料庫 (作為未來數據分析用)
⬇
**驗證回饋**:
*   **一般題型**: 直接回傳結果，不調用 AI (節省成本)
*   **費曼學習法 (Feynman)**: 檢查輸入長度是否足夠 (靜態驗證)
⬇
**導航**: 若正確 -> 解鎖下一個節點；若錯誤 -> 提示重試
