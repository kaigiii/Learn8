# 測試與 AI 開關

這份文件整理測試策略與 AI 觸發條件，讓本機與 CI 的行為一致可控。

預設測試模式不會呼叫真實 AI，避免在本地開發或 CI 中持續消耗 token。
建議把這套規則當成團隊預設：

- 本機日常開發：跑 non-AI tests
- PR / CI：只跑 non-AI tests
- 只有在你要驗證 provider 串接、prompt smoke、或真實外部行為時，才手動跑 AI tests

## Backend Tests

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
python3.12 -m pytest tests -q
```

如果你想手動跑會真的呼叫 AI provider 的 smoke tests：

```bash
cd backend
LEARN8_RUN_AI_TESTS=1 python3.12 -m pytest tests -m ai -q
```

測試策略：

- 一般測試：使用 fake LLM / fake RAG，不耗 token
- `@pytest.mark.ai`：只有你明確開啟時才會跑真 AI
- 適合放進 CI 的預設模式：`python3.12 -m pytest tests -q`
- 測試從 `backend/pytest.ini` 讀取 marker 規則
- `LEARN8_RUN_AI_TESTS` 沒開時，AI smoke tests 會自動 skip

CI 目前也遵守同一規則：

- backend CI：只跑不耗 token 的 pytest
- frontend CI：跑 TypeScript type check
- 真 AI smoke tests：預設不進 CI

常用情境對照：

- 想確認本地改動沒壞後端核心行為：`python3.12 -m pytest tests -q`
- 想只看某一個檔案：`python3.12 -m pytest tests/test_user_ledger.py -q`
- 想驗證真 AI provider 仍可用：`LEARN8_RUN_AI_TESTS=1 python3.12 -m pytest tests -m ai -q`
- 想看 CI 會跑什麼：查看 `.github/workflows/ci.yml`

如果你的 Python 環境是系統管理型環境，`pip install` 可能會被拒絕。這時建議優先使用虛擬環境：

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python3.12 -m pytest tests -q
```

## 注意事項

- backend 測試預設不呼叫真實 AI；要耗 token 的 smoke tests 必須手動開 `LEARN8_RUN_AI_TESTS=1`

## Arena 核心流轉測試 (Match Acceptance)

由於 Arena 的對戰狀態涉及多個玩家與複雜的計時邏輯，我們提供了一個專用的驗收腳本來模擬完整的對戰生命週期（包含配對、進入 Match、回合判定、超時處理與獎勵發放）：

```bash
cd backend
python3.12 -m scripts.test_match_acceptance
```

如果在重構後對對戰邏輯有疑慮，優先跑這個腳本確保核心狀態機運作正常。
