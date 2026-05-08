# FEYNMAN_INTERACTIVE_REDESIGN.md

## 1. 核心概念 (Core Concept)
將目前的「單次論述評估」模式轉向「多輪互動教學」模式。AI 的角色從「評分考官」轉變為「好奇的學生」，而使用者則扮演「導師」的角色。

## 2. 角色設定 (Persona Shift)
- **AI 角色**：一個對該主題感興趣但基礎薄弱的學生。
- **目標**：透過提問引導使用者進行深入淺出的解釋。
- **語氣**：好奇、會針對使用者的模糊地帶提出追問，但不具攻擊性。

## 3. 遊戲規則 (Game Mechanics)
- **最大輪次 (Max Rounds)**：預設為 **10 輪**。
- **勝利條件**：在 10 輪對話內，AI 學生明確表示「我完全理解了！」並給出一個正確的總結。
- **失敗條件**：達到第 10 輪時，AI 學生仍表示「還是不太明白...」，則該關卡判定為失敗。
    - **補救機制 (Remedial Suggestion)**：當判定失敗時，系統應結合 RAG 知識庫上下文，為使用者提供「更好的講解建議」或「缺失的關鍵點」，幫助使用者學習如何改進解釋。
- **評分標準**：
    - 準確性：解釋是否正確。
    - 簡單化：是否使用了過多專業術語。
    - 邏輯性：是否有條理。

## 4. 實作計劃 (Implementation Plan)

### A. 後端變更 (Backend Changes)
- **Prompt 更新**：設計新的 `SYSTEM_PROMPT_FEYNMAN_STUDENT`，定義其提問策略與理解判斷邏輯。
- **狀態管理**：
    - 需要在 `LessonSession` 或類似的狀態機中追蹤當前的輪次與對話歷史。
    - 新增一個 `chat_feynman` 的 API 端點（或擴充現有的 submission 邏輯）來處理每輪的對話。
- **判定邏輯**：
    - LLM 需要在每輪回傳一個 JSON，包含 `student_reply` (對話內容) 與 `is_satisfied` (是否已理解)。
    - **失敗總結**：若達到 10 輪未過關，額外呼叫一次 LLM（或在最後一輪回傳）生成「講解建議」，該建議需參考 RAG 上下文。

### B. 前端變更 (Frontend Changes)
- **UI 更新**：`FeynmanQuestion.tsx` 從簡單的 Textarea 轉變為對話式 UI（類似 Chatbot 介面）。
- **視覺回饋**：
    - 顯示目前是第幾輪（Round X/10）。
    - 學生角色的頭像或語氣氣泡。
- **結束狀態**：當 `is_satisfied` 為真或輪次結束時，顯示最終評分結果與過關/失敗動畫。
    - **建議顯示**：在失敗畫面中，以「費曼老師的私房建議」形式展示改進建議。

### C. 配置更新 (Configuration Updates)
- 修改 `FeynmanMirror.yaml`，新增 `max_rounds` 等可選配置項。

## 5. 預計開發時程 (Estimated Timeline)
1. **第一階段**：重新編寫提示詞 (Prompt Engineering) 與測試互動性。
2. **第二階段**：後端對話狀態機制實作。
3. **第三階段**：前端 Chat UI 整合與動畫處理。
4. **第四階段**：整合測試與參數調優。

---
**備註**：此計劃將保留在 `docs/archive` 中作為開發參考。
