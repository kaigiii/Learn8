# 整合 Microsoft MarkItDown 實現多格式文檔統一解析與圖片提取之實作計劃書

本計劃書旨在為開發團隊提供一份極度完整的實作指南，說明如何引入 Microsoft 的 `markitdown` 與 `markitdown-ocr` 專案，用以重構與優化現有的文檔解析引擎（目前僅支援 PDF 與純文字），擴充對 Word (`.docx`)、PowerPoint (`.pptx`)、Excel (`.xlsx`) 的支援，並確保文檔內含的圖片能被自動提取、上傳至雲端儲存（或本地靜態目錄），且以標準 Markdown 圖片標籤 `![alt](url)` 的形式完美保留並錨定在正確的位置中，供後續 RAG（檢索增強生成）與個人化講義生成使用。

---

## 1. 現有架構與痛點分析

### 1.1 現有文檔解析架構
* **PDF 解析雙軌制**：
  - **普通/混合模式**：使用 `pdfplumber` 進行文字和表格提取。
  - **視覺模式 (`pdf_vision.py`)**：使用 `PyMuPDF` 提取單頁文字與個別圖片，隨後將文字與圖片的 Base64 數據一併送至 Vision LLM（如 Gemini），由 LLM 重排並輸出含有圖片 URL 的 Markdown。
* **純文字解析**：針對 `.txt`、`.md`、`.csv`、`.json` 及代碼檔案，由 `TextParser` 直接讀取文字內容。

### 1.2 現有痛點
1. **不支援 Office 文件**：不支援常見的 `.docx`、`.pptx`、`.xlsx` 等格式，限制了使用者匯入教學素材的類型。
2. **高昂的 Vision API 成本**：為了保留 PDF 中的圖片並將其定位在 Markdown 的正確位置，原有方案必須將每一頁的文字和圖片打包送給 Vision LLM，導致大文件轉檔成本高且速度慢。
3. **缺少成熟的統一解析架構**：缺乏一個標準的接口來統一處理不同類型文件的多模態解析。

---

## 2. 整合 MarkItDown 的可行性與設計藍圖

為了實現「統一解析」且「完美保留圖片位置」，我們採用**雙軌分流與後處理聚合**的設計。

```
                       ┌──────────────────────────────┐
                       │        上傳文檔/檔案         │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                             [ 檔案類型分流判斷 ]
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
     [ Office 文件 (Docx/Pptx/Xlsx) ]                 [ PDF 檔案 ]
              │                                               │
              ▼                                               ▼
     [ MarkItDown 轉檔 ]                             [ 客製化 PdfOCRConverter ]
  啟用 `keep_data_uris=True`                         幾何排序文字與圖片 (Y軸座標)
  產出含 Base64 內嵌圖片的 MD                      調用 VLM 辨識圖片並提取二進位流
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      │
                                      ▼
                       [ 後處理聚合引擎 (Post-Processor) ]
                       1. 正則匹配提取 Base64 圖片流
                       2. 調用 FileService 存檔 (上傳 S3)
                       3. 寫入 CourseMediaAssetModel 資料庫
                       4. 將 MD 中的 Base64 替換成靜態 URL
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │     最終 Markdown 結果       │
                       │     (寫入 Chroma & 數據庫)   │
                       └──────────────────────────────┘
```

### 2.1 Office 檔案設計（Mammoth & python-pptx 驅動）
Microsoft `markitdown` 轉換 Word 和 PPT 時，會將檔案解析為 HTML 再轉 Markdown，其圖片天生就錨定在正確的段落位置。
* **策略**：轉換時開啟 `keep_data_uris=True`。這會在產出的 Markdown 中原封不動保留 Base64 圖片：`![alt](data:image/png;base64,...)`。
* **聚合**：使用 Regex 抓取 Base64，解碼為二進位流並寫入 S3，取得靜態 URL 後替換回 Markdown 中。

### 2.2 PDF 檔案設計（客製化 PdfConverterWithOCR 驅動）
由於 `markitdown` 預設的 PDF 轉換器只提取文字與表格，不處理圖片。我們必須繼承並客製化 `markitdown-ocr` 的 `PdfConverterWithOCR`：
* **客製化內容**：重寫 `PdfConverterWithOCR` 的 Markdown 組裝邏輯。在圖片經過 VLM 進行 OCR 辨識文字後，**不丟棄圖片流**，而是將圖片流寫入磁碟並取得 S3 URL，最後輸出：
  `![{ocr_text}]({img_url})` 
  而非預設的文字區塊 `*[Image OCR] ...`。

---

## 3. 具體修改與實作步驟

### 3.1 步驟一：更新環境依賴
在 `backend/requirements.txt` 中新增 `markitdown` 及其 OCR 依賴：
```text
markitdown>=0.1.6
pdfminer-six>=20260107
pdfplumber>=0.11.10
pymupdf>=1.28.0
mammoth~=1.11.0
python-docx
python-pptx
pandas
openpyxl
```

### 3.2 步驟二：新建客製化解析器 `markitdown_parser.py`
在 `backend/app/services/ai_engine/kb/parsers/` 下新建 `markitdown_parser.py`。
本文件將包含：
1. **`CustomPdfConverterWithOCR`**：繼承自 `markitdown_ocr.PdfConverterWithOCR`，重寫其組裝圖片標籤的邏輯。
2. **`MarkItDownOfficeParser`**：處理 Office 文件（docx, pptx, xlsx）的轉換，並將 Base64 圖片進行後處理上傳。

#### 核心代碼設計參考：

```python
import re
import io
import base64
import os
from typing import BinaryIO, Any
from markitdown import MarkItDown, DocumentConverterResult
from markitdown_ocr import PdfConverterWithOCR, LLMVisionOCRService
from app.services.infra.files.service import FileService
from app.models.course_media_asset import CourseMediaAssetModel

class CustomPdfConverterWithOCR(PdfConverterWithOCR):
    """
    客製化 PDF OCR 轉換器。
    在幾何排序輸出時，將圖片二進位數據存檔，並在 Markdown 中輸出標準 ![]() 標籤。
    """
    def __init__(self, ocr_service=None, user_id: int = None, course_folder: str = None):
        super().__init__(ocr_service=ocr_service)
        self.user_id = user_id
        self.course_folder = course_folder
        self.file_service = FileService()

    def convert(self, file_stream: BinaryIO, stream_info: Any, **kwargs: Any) -> DocumentConverterResult:
        # 呼叫父類獲取包含幾何排序的 items
        # 改寫原來的 markdown 拼接邏輯：
        # 當遇到 type == 'image' 時，不輸出 *[Image OCR] 標記，而是將其寫入 S3 並替換為 ![ocr_text](img_url)
        # (實作細節需參考 _pdf_converter_with_ocr.py 進行重寫)
        pass

class MarkItDownParser:
    """
    統一調度 MarkItDown 的解析器。
    """
    def __init__(self, user_id: int = None, course_folder: str = None):
        self.user_id = user_id
        self.course_folder = course_folder
        self.file_service = FileService()
        
    def parse_office_file(self, file_path: str) -> str:
        """
        處理 DOCX/PPTX 轉檔，並對其 Base64 內嵌圖片進行 S3 提取替換。
        """
        md = MarkItDown()
        # 啟用 keep_data_uris=True 獲得內嵌圖片
        result = md.convert(file_path, keep_data_uris=True)
        markdown = result.text_content
        
        # 使用 Regex 提取所有的 base64 圖片並替換
        pattern = re.compile(r"!\[(?P<alt>.*?)\]\((?P<url>[^)]+)\)")
        
        img_idx = 0
        def replace_b64(match):
            nonlocal img_idx
            alt = match.group("alt") or "image"
            url = match.group("url")
            
            if not url.startswith("data:"):
                return match.group(0)
                
            mime_match = re.match(r"data:(?P<mime>image/[^;]+);base64,(?P<b64>.+)", url)
            if not mime_match:
                return match.group(0)
                
            mime = mime_match.group("mime")
            b64_data = mime_match.group("b64")
            ext = mime.split("/")[-1]
            
            # 解碼 Base64
            img_bytes = base64.b64decode(b64_data)
            
            # 透過 FileService 儲存圖片
            img_filename = f"office_img_{img_idx}.{ext}"
            img_idx += 1
            
            # 儲存並獲取 URL
            img_url = self.file_service.save_image_bytes(img_bytes, self.user_id, self.course_folder, img_filename)
            
            # 註冊至資料庫 CourseMediaAssetModel
            self.register_media_asset(img_filename, img_url, alt)
            
            return f"![{alt}]({img_url})"
            
        return pattern.sub(replace_b64, markdown)

    def register_media_asset(self, filename: str, url: str, description: str):
        # 寫入資料庫邏輯，便於 lesson_worker.py 後續檢索圖片
        pass
```

### 3.3 步驟三：在 `DocumentProcessor` 中註冊新格式與解析器
修改 `backend/app/services/ai_engine/kb/document_processor.py`：
1. 引入新建的 `MarkItDownParser` 與 `CustomPdfConverterWithOCR`。
2. 註冊新格式：
   ```python
   # 註冊 Office 文件到 MarkItDownOffice 解析器
   DocumentProcessor.register_parser(".docx", MarkItDownOfficeParser())
   DocumentProcessor.register_parser(".pptx", MarkItDownOfficeParser())
   DocumentProcessor.register_parser(".xlsx", MarkItDownOfficeParser())
   ```
3. 修改 PDF 的解析策略分流，當策略為 `fast` 或 `ocr` 時，採用 `CustomPdfConverterWithOCR`。

---

## 4. 效益與潛在影響評估

### 4.1 效益
1. **多格式支援**：用戶可自由匯入 `.docx`、`.pptx` 等 Office 文檔做為課程素材，極大提升平台易用性。
2. **降低 API 成本**：PDF 普通解析不需要呼叫 LLM，而在使用 OCR 模式時，僅需對文檔內的實體圖片區塊調用 LLM Vision 進行 OCR，無需每次都將整頁的文字重新丟給 LLM 排版。
3. **優異的 Office 轉檔排版**：`markitdown` 整合了 `mammoth`，對 Word 表格、清單的 Markdown 格式轉換精確度高。

### 4.2 潛在影響（開發者需注意）
1. **雙欄排版 PDF 換行問題**：
   在 PDF 幾何排序中，多欄排版可能導致文字被左右交錯讀取。對於排版極度複雜的 PDF 文件，建議在設定檔中將 `PDF_PARSE_STRATEGY` 設回 `vision`（沿用原有方案的視覺 LLM 理解）。
2. **依賴套件的大小**：
   `markitdown` 所依賴的 `onnxruntime` 等套件體積較大，在進行 Docker 容器打包時，需注意增建 Docker Layer 的快取優化。

---

## 5. 驗證與測試計劃

### 5.1 單元測試
編寫測試腳本（可參考 `scratch/test_custom_parser.py`）驗證以下幾點：
1. 傳入 `.docx` 檔案，確保輸出的 Markdown 中所有 Base64 圖片皆已被成功替換為對應的 URL，且本地/S3 已成功生成實體圖片檔。
2. 傳入包含直排文字與圖片的 PDF，驗證 `CustomPdfConverterWithOCR` 是否能精準還原文字並將 `![alt](url)` 插在對應的高度座標中。

### 5.2 系統集成測試
1. 進入後端上傳 API 接口，模擬匯入一篇圍棋 `.pptx` 簡報。
2. 檢查 `course_media_assets` 資料表是否成功寫入該簡報的所有投影片插圖。
3. 觸發 `lesson_worker.py` 生成講義，驗證 AI 講義生成器是否能成功讀取並插入這些來自簡報的圖片。
