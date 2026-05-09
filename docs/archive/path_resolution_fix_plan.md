# 專案路徑解析優化計劃書 (Path Resolution Refactoring Plan)

## 1. 現況分析 (Current Issues)

經過全面掃描，專案中存在以下兩種不穩定的路徑處理方式：

### 1.1 過度依賴 `os.getcwd()`
- **受影響檔案**：`audio.py`, `file_service.py`
- **風險**：`os.getcwd()` 取決於啟動伺服器時的終端機當前路徑。如果管理員在 `backend/` 目錄外啟動，或是使用不同的啟動指令，`data/` 目錄將無法被正確定位，導致音檔快取、上傳功能失效。

### 1.2 脆弱的相對層級解析 (`.parent.parent...`)
- **受影響檔案**：`custom_courses.py`, `auth.py`, `course_loader.py`, `config.py`, `component_loader.py`
- **風險**：大量使用 `.parent` 或 `.parents[4]`。一旦檔案結構發生調整（例如將 `endpoints` 下的檔案移入子目錄），路徑解析將立即中斷。

---

## 2. 目標 (Objectives)

- **中心化管理**：將所有基礎目錄（Root, Data, Uploads, Presets）定義在 `app.core.config.settings` 中。
- **絕對路徑化**：所有業務邏輯均基於 `BASE_DIR` 生成絕對路徑，不再依賴啟動環境或檔案層級。
- **類型安全**：使用 `pathlib.Path` 物件進行操作，取代 `os.path.join` 字符串拼接。

---

## 3. 實作步驟 (Implementation Steps)

### 第一階段：定義核心變數 (Core Config)
修改 `backend/app/core/config.py`，增加以下定義：
- `BASE_DIR`: 專案後端根目錄。
- `DATA_DIR`: `BASE_DIR / "data"`。
- `UPLOAD_DIR`: `DATA_DIR / "uploads"`。
- `PRESETS_DIR`: `DATA_DIR / "presets"`。
- `CUSTOM_COURSES_DIR`: `DATA_DIR / "custom_published_courses"`。

### 第二階段：全域替換 (Global Replacement)
1.  **修正 `audio.py`**：將 `os.getcwd()` 替換為 `settings.PRESETS_DIR` 與 `settings.UPLOAD_DIR`。
2.  **修正 `custom_courses.py`**：移除所有 `.parent.parent...` 邏輯，改用 `settings.CUSTOM_COURSES_DIR`。
3.  **修正 `file_service.py`**：將上傳路徑基準點改為 `settings.UPLOAD_DIR`。
4.  **修正 `auth.py`**：移除 `BACKEND_ROOT_DIR = Path(__file__).resolve().parents[4]`，改用 `settings.BASE_DIR`。

### 第三階段：清理與測試 (Cleanup & Test)
- 確保所有 `os.path.join` 已更換為 `Path / "sub"` 語法。
- 測試「音檔生成」、「課程發佈」與「檔案上傳」在不同啟動路徑下是否運作正常。

---

## 4. 預期效益 (Expected Benefits)

- **部署靈活性**：無論在 Docker 內部或本地開發環境，只要 `BASE_DIR` 正確，功能就不會損壞。
- **維護性**：若未來需要更改資料存儲位置（例如移至外部掛載硬碟），只需修改 `config.py` 一處即可完成全域更新。
- **程式碼整潔度**：消除 API 檔案中與業務邏輯無關的路徑計算程式碼。
