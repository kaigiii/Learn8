import asyncio
import json
import logging
from typing import Any, List, Type, Optional
from pydantic import BaseModel
from app.services.ai_engine.clients.base_provider import BaseLLMProvider

logger = logging.getLogger(__name__)

def generate_showcase_stages():
    """A visual tour of every enabled game module; each stage is intentionally self-contained."""
    return [
        {"component": "ExplainerMedia", "data": {
            "title": "二分搜尋：每次排除一半",
            "explanation": "在已排序資料中，二分搜尋每次只保留可能答案的一半。資料越大，這種縮小範圍的方式越有價值。",
            "bullets": ["先確認資料已排序", "比較中間值", "只保留其中一半"], "mediaType": "svg",
            "mediaDescription": "二分搜尋從完整範圍逐步縮小到目標",
            "mediaSvg": '<svg viewBox="0 0 520 190" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg"><rect width="520" height="190" rx="24" fill="#eefaf8"/><rect x="28" y="62" width="126" height="66" rx="16" fill="#d8f1ef"/><text x="91" y="92" text-anchor="middle" font-family="system-ui" font-size="17" font-weight="700" fill="#235257">1 — 64</text><text x="91" y="113" text-anchor="middle" font-family="system-ui" font-size="11" fill="#52777a">完整範圍</text><path d="M168 95H230" stroke="#0d9488" stroke-width="5" stroke-linecap="round"/><path d="M219 83l16 12-16 12" fill="none" stroke="#0d9488" stroke-width="5" stroke-linecap="round"/><rect x="246" y="62" width="126" height="66" rx="16" fill="#dff5e7"/><text x="309" y="92" text-anchor="middle" font-family="system-ui" font-size="17" font-weight="700" fill="#235257">33 — 64</text><text x="309" y="113" text-anchor="middle" font-family="system-ui" font-size="11" fill="#52777a">保留一半</text><path d="M386 95H432" stroke="#0d9488" stroke-width="5" stroke-linecap="round"/><circle cx="465" cy="95" r="26" fill="#c7ece8"/><text x="465" y="101" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="700" fill="#235257">目標</text></svg>'}},
        {"component": "MultipleChoice", "data": {"question": "哪一種時間複雜度在資料量變大時，成長最慢？", "options": [{"id": "a", "text": "O(n²)"}, {"id": "b", "text": "O(n log n)"}, {"id": "c", "text": "O(log n)"}, {"id": "d", "text": "O(n)"}], "correctOptionId": "c", "explanation": "O(log n) 每次大幅縮小問題範圍。"}},
        {"component": "MatchingPairs", "data": {"question": "配對資料結構與最貼近的使用情境", "pairs": [{"id": "pair-1", "left": "Stack", "right": "瀏覽器上一頁／下一頁"}, {"id": "pair-2", "left": "Queue", "right": "列印工作排隊"}, {"id": "pair-3", "left": "Hash Map", "right": "用帳號快速找到資料"}, {"id": "pair-4", "left": "Heap", "right": "持續取出最高優先任務"}]}},
        {"component": "Ordering", "data": {"steps": ["取得使用者輸入", "驗證格式與範圍", "執行核心運算", "回傳結果與回饋"]}},
        {"component": "HeapSortSimulator", "data": {"title": "Heap Sort 動態演示", "initialArray": [12, 15, 10, 5, 8, 7], "explanation": "觀察數字如何先形成最大堆積，再依序被放到排序後的位置。", "messages": {"ready": "資料已載入", "building": "正在建立最大堆積", "sorting": "正在取出最大值並重建堆積", "done": "排序完成"}}},
        {"component": "HeapSortExercise", "data": {"title": "手動修復最大堆積", "initialArray": [9, 14, 11, 6, 12, 7], "explanation": "找出子節點大於父節點的位置，手動交換後完成提取。", "messages": {"initial": "先找出違反最大堆積規則的位置", "successSwap": "交換正確，繼續檢查", "successExtract": "最大值已歸位", "errorSwap": "父節點必須不小於子節點", "errorInvalid": "請先修復堆積"}, "hints": ["從最後一個有子節點的位置往上檢查", "14 應該往上移動", "堆積正確後才能提取根節點"]}},
        {"component": "DynamicCategorySorter", "data": {"title": "AI 名詞分類挑戰", "instruction": "把每張卡片分到監督式、非監督式或強化學習。", "categories": [{"id": "supervised", "label": "監督式學習", "description": "從帶標籤資料學習"}, {"id": "unsupervised", "label": "非監督式學習", "description": "從資料中找結構"}, {"id": "reinforcement", "label": "強化學習", "description": "透過回饋調整策略"}], "cards": [{"id": "card-1", "text": "用已標記信件判斷垃圾郵件", "correctCategoryId": "supervised"}, {"id": "card-2", "text": "依購物行為把顧客分群", "correctCategoryId": "unsupervised"}, {"id": "card-3", "text": "讓遊戲角色依獎勵學會走位", "correctCategoryId": "reinforcement"}, {"id": "card-4", "text": "預測房價", "correctCategoryId": "supervised"}, {"id": "card-5", "text": "找出新聞主題群", "correctCategoryId": "unsupervised"}, {"id": "card-6", "text": "讓機器手臂學會抓取", "correctCategoryId": "reinforcement"}], "hints": ["先問：答案標籤、資料結構，還是獎勵訊號？"]}},
        {"component": "GanttLogicScheduler", "data": {"title": "產品發表倒數排程", "timeLimit": 8, "instruction": "在 8 個工作日內完成測試、影片、頁面上線與發表。", "tasks": [{"id": "test", "label": "功能測試", "defaultDuration": 2}, {"id": "video", "label": "錄製展示影片", "defaultDuration": 2}, {"id": "release", "label": "部署發表頁面", "defaultDuration": 1}, {"id": "launch", "label": "正式發表", "defaultDuration": 1}], "dependencies": ["test -> video", "video -> release", "release -> launch"]}},
        {"component": "DocumentAnomalyDebugger", "data": {"title": "資料品質除錯：找出三個不可信欄位", "instruction": "點擊報表中的異常值，再選擇最合理的錯誤原因。", "documentHtml": '<h3>SaaS 產品週報</h3><table><thead><tr><th>指標</th><th>本週</th><th>上週</th><th>備註</th></tr></thead><tbody><tr><td>活躍使用者</td><td>12,480</td><td>11,902</td><td>正常</td></tr><tr><td>轉換率</td><td data-anomaly-id="a-rate">186%</td><td>4.8%</td><td>待確認</td></tr><tr><td>退款筆數</td><td data-anomaly-id="a-refund">-12</td><td>18</td><td>待確認</td></tr><tr><td>營收</td><td>$82,400</td><td>$78,100</td><td data-anomaly-id="a-date">資料更新：兩週前</td></tr></tbody></table>', "anomalies": [{"anomalyId": "a-rate", "reason": "百分比超出合理範圍，可能是分母或格式錯誤", "points": 3}, {"anomalyId": "a-refund", "reason": "退款筆數不可為負值", "points": 3}, {"anomalyId": "a-date", "reason": "資料過期，不能作為本週決策依據", "points": 3}], "checklistOptions": ["百分比超出合理範圍，可能是分母或格式錯誤", "退款筆數不可為負值", "資料過期，不能作為本週決策依據", "這是合理的季節性波動"]}},
        {"component": "GoBoardCoordinate", "data": {"question": "黑棋下在哪裡可以封住白棋 E5 的最後一口氣？", "board": {"size": 9, "black": ["D5", "F5", "E4"], "white": ["E5"], "marks": []}, "playerColor": "B", "expectedAnswer": "E6", "explanation": "白棋 E5 的左、右、下已被黑棋佔住，E6 是最後一口氣。"}},
        {"component": "GoBoardNumeric", "data": {"question": "被標記的黑棋 E5 還有幾口氣？", "board": {"size": 9, "black": ["E5"], "white": ["D5", "F5", "E4"], "marks": ["E5"]}, "playerColor": "W", "expectedAnswer": "1", "explanation": "E5 的左、右、下已被白棋佔住，只剩 E6。"}},
        {"component": "FeynmanMirror", "data": {"topic": "Heap Sort 堆積排序", "prompt": "假設我是你的學生，對「Heap Sort 堆積排序」感到很好奇。請試著向我解釋它的核心原理，讓我這個初學者也能聽懂！", "sampleAnswer": "「Heap Sort 堆積排序」的核心在於利用二元堆積（Binary Heap）結構。以最大堆積為例，根節點永遠是最大值，我們不斷將根節點與末尾元素交換並縮減範圍，隨後執行向下調整（Heapify）來維持屬性，最終達成 O(n log n) 的原地排序。", "maxRounds": 8}},
    ]

def generate_algo_nodes():
    """動態生成課程節點，第一個節點是完整的 Learn8 元件展示關卡。"""
    raw_nodes = [
        ("algo-showcase-1", "互動技能挑戰集", "每一關用不同方式思考與作答，完整體驗 Learn8 的互動元件。", "logic"),
        # Chapter 1
        ("algo-1-1", "Heap Sort 堆積排序", "基於二元堆積的排序演算法。", "tree"),
        ("algo-1-2", "迭代演算法", "以選擇排序 (Selection Sort) 為例。", "sorting"),
        ("algo-1-3", "遞迴演算法", "階乘與費氏數列。", "tree"),
        ("algo-1-4", "虛擬碼標準", "賦值、條件與迴圈。", "logic"),
        ("algo-1-5", "抽象資料型別 (ADT) 概念", "堆疊與佇列。", "logic"),
        ("algo-1-6", "效能分析導論", "效率評估基礎。", "logic"),
        # Chapter 2
        ("algo-2-1", "Big-O 漸進符號", "上界 (Upper bounds) 分析。", "search"),
        ("algo-2-2", "Omega (Ω) 符號", "下界 (Lower bounds) 分析。", "search"),
        ("algo-2-3", "Theta (Θ) 符號", "嚴格界限 (Tight bounds)。", "search"),
        ("algo-2-4", "成長率比較", "比較不同效率等級。", "logic"),
        ("algo-2-5", "攤還分析 (Amortized Analysis)", "長期平均成本評估。", "logic"),
        ("algo-2-6", "大師定理 (Master Theorem)：導論", "遞迴方程基礎。", "tree"),
        ("algo-2-7", "大師定理：案例分析", "求解遞迴關係式。", "tree"),
        # Chapter 3
        ("algo-3-1", "貪婪演算法基礎", "最優子結構概念。", "logic"),
        ("algo-3-2", "分數背包問題", "連續品項選擇優化。", "sorting"),
        ("algo-3-3", "工作排程問題", "具期限的利潤最大化。", "sorting"),
        ("algo-3-4", "霍夫曼編碼：樹狀建立", "基於頻率的合併策略。", "tree"),
        ("algo-3-5", "霍夫曼編碼：編碼流程", "前綴碼 (Prefix-free) 產生。", "tree"),
        ("algo-3-6", "Prim 演算法", "最小生成樹 (MST) 擴張。", "graph"),
        ("algo-3-7", "Kruskal 演算法", "基於邊排序的 MST。", "graph"),
        # Chapter 4
        ("algo-4-1", "分治法 (D&C) 範式", "分解、解決、合併。", "tree"),
        ("algo-4-2", "二分搜尋法", "O(log n) 高效搜尋。", "search"),
        ("algo-4-3", "合併排序法 (Merge Sort)", "遞迴拆解與合併。", "sorting"),
        ("algo-4-4", "快速排序法 (Quick Sort)", "基準點 (Pivot) 分割。", "sorting"),
        ("algo-4-5", "Strassen 矩陣乘法", "更快的矩陣運算。", "tree"),
        ("algo-4-6", "中位數尋找演算法", "線性時間選擇。", "sorting"),
        ("algo-4-7", "最近點對問題", "幾何分治法應用。", "tree"),
        # Chapter 5
        ("algo-5-1", "廣度優先搜尋 (BFS)", "層級遍歷策略。", "graph"),
        ("algo-5-2", "深度優先搜尋 (DFS)", "深度遍歷策略。", "graph"),
        ("algo-5-3", "拓撲排序", "依賴關係排序。", "graph"),
        ("algo-5-4", "二元搜尋樹 (BST) 操作", "樹狀邏輯基礎。", "tree"),
        ("algo-5-5", "AVL 樹", "自我平衡旋轉技術。", "tree"),
        ("algo-5-6", "紅黑樹", "節點顏色屬性與平衡。", "tree"),
        ("algo-5-7", "B-樹", "磁碟優化的搜尋結構。", "tree"),
        # Chapter 6
        ("algo-6-1", "狀態空間樹", "回溯法 (Backtracking) 基礎。", "tree"),
        ("algo-6-2", "N-皇后問題", "典型回溯搜尋應用。", "tree"),
        ("algo-6-3", "子集合之和問題", "尋找總和為 K 的子集。", "tree"),
        ("algo-6-4", "圖形著色問題", "鄰接節點顏色分配。", "graph"),
        ("algo-6-5", "漢米爾頓迴圈", "遍歷所有頂點的路徑。", "graph"),
        ("algo-6-6", "分支定界法 (Branch and Bound)", "最佳剪枝策略。", "tree"),
        # Chapter 7
        ("algo-7-1", "動態規劃基礎", "記憶化 (Memoization) vs 表格化 (Tabulation)。", "logic"),
        ("algo-7-2", "0/1 背包問題 (DP)", "子問題表格建立。", "logic"),
        ("algo-7-3", "最長共同子序列 (LCS)", "序列比對演算法。", "logic"),
        ("algo-7-4", "矩陣鏈乘法", "尋找最佳運算順序。", "logic"),
        ("algo-7-5", "Floyd-Warshall 演算法", "全點對最短路徑。", "graph"),
        ("algo-7-6", "Bellman-Ford 演算法", "處理負邊權重。", "graph"),
        ("algo-7-7", "編輯距離 (Edit Distance)", "字串轉換代碼分析。", "logic"),
        # Chapter 8
        ("algo-8-1", "複雜度類別", "P 與 NP 的定義。", "search"),
        ("algo-8-2", "多項式化簡 (Reductions)", "難度證明方法。", "logic"),
        ("algo-8-3", "Cook 定理", "SAT 完備性證明。", "logic"),
        ("algo-8-4", "3-SAT 問題", "簡化版的滿意度問題。", "logic"),
        ("algo-8-5", "分群問題 (Clique)", "尋找完全子圖。", "graph"),
        ("algo-8-6", "近似演算法", "處理 NP-Hard 問題的策略。", "logic"),
    ]

    nodes = []
    for node_id, title, desc, vibe in raw_nodes:
        if node_id == "algo-showcase-1":
            nodes.append({"id": node_id, "title": title, "description": desc, "stages": generate_showcase_stages()})
            continue
        stages = [
            # Stage 1: Simulator
            {
                "component": "HeapSortSimulator" if title == "Heap Sort" or "Heap Sort" in title else "ExplainerMedia",
                "data": {
                    "vibe": vibe,
                    "title": "Heap Sort：高效排序機器的運作原理" if title == "Heap Sort" or "Heap Sort" in title else f"{title} 核心概念說明",
                    "initialArray": [12, 15, 10, 5, 8, 7] if title == "Heap Sort" or "Heap Sort" in title else None,
                    "explanation": "歡迎來到 Heap Sort 的核心！這不是普通的排序，而是一場關於『秩序與權益』的平衡藝術。透過最大堆積（Max-Heap），我們能確保最關鍵的數據永遠在頂端。點擊模擬器，觀察數據如何在高效率的調整中完美歸位。" if title == "Heap Sort" or "Heap Sort" in title else f"深入理解 {title} 的運作邏輯與核心價值。",
                    "messages": {
                        "ready": "系統準備就緒。點擊「運行模擬」開啟 Heapify 自動調整流程。",
                        "building": "階段一：正在建立最大堆積... 我們正從底層開始，確保每個父節點都大於其子節點。",
                        "sorting": "階段二：提取與重構。將頂端的王者（最大值）移至末尾，並立即重新海選下一位領導者。",
                        "done": "任務完成！數據已透過 O(n log n) 的高效率達成完美排序。"
                    } if title == "Heap Sort" or "Heap Sort" in title else None,
                    "mediaType": "none",
                }
            },
            # Stage 2: Exercise
            {
                "component": "HeapSortExercise" if title == "Heap Sort" or "Heap Sort" in title else "MultipleChoice",
                "data": {
                    "title": "工程師任務：修復毀損的堆積結構",
                    "initialArray": [9, 14, 11, 6, 12, 7],
                    "explanation": "警告：目前的堆積結構已失去平衡！身為演算法工程師，請手動修復違規節點以重建『最大堆積』屬性，隨後執行提取操作完成排序。你能優雅地解決它嗎？",
                    "messages": {
                        "initial": "目標：找出並交換那些『子節點大於父節點』的異常位置。",
                        "successSwap": "修復正確！平衡感正在恢復，繼續檢查其他節點。",
                        "successExtract": "提取成功！最大值已精確歸位。剩下的結構正在自動收縮。",
                        "errorSwap": "修復失敗：父節點必須維持絕對領先！請重新評估交換對象。",
                        "errorInvalid": "操作無效：目前的結構尚未準備好進行提取，請先完成堆積建立。"
                    },
                    "hints": [
                        "提示 1：從 index 2 (右下方) 的節點開始向下檢查其子節點。",
                        "提示 2：14 目前僭越了它的父節點 9，請將它們進行交換。",
                        "提示 3：當整個堆積都符合屬性後，點擊根節點 (index 0) 進行提取。"
                    ]
                } if title == "Heap Sort" or "Heap Sort" in title else {
                    "question": f"關於 {title} 的核心運作目標是什麼？",
                    "options": [{"id": "a", "text": "透過特定結構優化時間複雜度"}, {"id": "b", "text": "確保資料在任何硬體下都能精確執行"}],
                    "correctOptionId": "a"
                }
            },
            # Stage 3: Complexity Analysis (ExplainerMedia)
            {
                "component": "ExplainerMedia",
                "data": {
                    "title": "深度分析：為什麼 Heap Sort 是穩定的首選？",
                    "explanation": (
                        "Heap Sort 的魅力在於其絕對的穩定性：\n"
                        "1. 時間複雜度：無論輸入資料如何分佈，始終維持 O(n log n) 的高效表現。\n"
                        "2. 空間利用：它是典型的就地排序，額外空間複雜度僅為 O(1)。\n"
                        "3. 結構優勢：利用完全二元樹特性，讓每一次調整都嚴格控制在樹高範圍內。"
                    ),
                    "mediaType": "image" if title == "Heap Sort" or "Heap Sort" in title else "none",
                    "mediaUrl": "/api/v1/courses/files/public/heap-sort-complexity.png" if title == "Heap Sort" or "Heap Sort" in title else None,
                }
            },
            # Stage 4: Complexity Quiz (MultipleChoice)
            {
                "component": "MultipleChoice",
                "data": {
                    "question": "為什麼在處理大型數據集時，Heap Sort 的最壞情況表現往往比Quick Sort更可靠？",
                    "options": [
                        {"id": "a", "text": "因為它不需要使用遞迴來處理子問題"},
                        {"id": "b", "text": "因為堆積結構保證了樹高平衡，避免了退化成 O(n^2) 的風險"},
                        {"id": "c", "text": "因為它能將空間複雜度優化到比 O(1) 還要低"},
                        {"id": "d", "text": "因為它在快取存取（Cache Locality）上有絕對的優勢"}
                    ],
                    "correctOptionId": "b"
                }
            },
            # Stage 5: Feynman Teaching
            {
                "component": "FeynmanMirror",
                "data": {
                    "topic": title,
                    "prompt": f"挑戰：假設我是你的學生，對「{title}」感到很好奇。請試著向我解釋它的核心原理，讓我這個初學者也能聽懂！",
                    "sampleAnswer": f"「{title}」的核心在於利用二元堆積（Binary Heap）結構。以最大堆積為例，根節點永遠是最大值，我們不斷將根節點與末尾元素交換並縮減範圍，隨後執行向下調整（Heapify）來維持屬性，最終達成 O(n log n) 的原地排序。",
                    "maxRounds": 8
                }
            }
        ]
        nodes.append({"id": node_id, "title": title, "description": desc, "stages": stages})
    return nodes

ALGO_NODES_DATA = generate_algo_nodes()

class MockLLMProvider(BaseLLMProvider):
    def __init__(self):
        super().__init__()

    def bind_files(self, files: List[str], use_google_file_api: bool = True) -> "BaseLLMProvider":
        return self

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        await asyncio.sleep(0.5)
        return "這是來自 Learn8 演算法專家的模擬回應。"

    async def generate_structured(self, messages: List[Any], schema: Type[BaseModel], **kwargs) -> BaseModel:
        await asyncio.sleep(1.0)
        msg_text = str(messages).lower()
        fields = getattr(schema, "model_fields", getattr(schema, "__fields__", {})).keys()
        schema_name = schema.__name__

        if "questions" in fields and "summary" not in fields and "stages" not in fields and "nodes" not in fields:
            return self._mock_questionnaire(schema)
            
        if "summary" in fields and "attributes" in fields:
            return self._mock_learner_profile(schema)

        if "courseTitle" in fields and "units" in fields:
            return self._mock_blueprint(schema)
            
        if "nodes" in fields:
            return self._mock_unit_expansion(schema, msg_text)

        if "stages" in fields or "component" in fields:
            # 偵測是否為補救教學請求
            if "failed records" in msg_text or "remedial" in schema_name.lower():
                return self._mock_remedial_stages(schema, msg_text)
            
            user_id = kwargs.get("user_id", 1)
            return self._mock_lesson_content(schema, msg_text, user_id=user_id)
        
        if "reply" in fields and "isSatisfied" in fields:
            return self._mock_feynman_round(schema, messages)

        if "isCorrect" in fields:
            return schema.model_validate({"isCorrect": True, "feedback": "解釋得非常出色！"})
            
        return schema.model_construct()

    def _mock_remedial_stages(self, schema: Type[BaseModel], msg_text: str) -> BaseModel:
        # 模擬 AI 根據使用者答錯的關卡，精準生成補救教學
        raw_remedial = []
        
        # 根據錯誤類型提供不同的補救
        if "heapsortexercise" in msg_text:
            raw_remedial.append({
                "component": "ExplainerMedia",
                "data": {
                    "title": "補救強化：堆積調整的核心直覺",
                    "explanation": (
                        "看來在手動操作上遇到了一些挑戰。別擔心！\n\n"
                        "請記住：『最大堆積』的靈魂在於——父節點永遠要比子節點大。\n"
                        "當你交換後，要像玩疊疊樂一樣，確保從上到下都維持這個秩序。\n"
                        "建議：下次嘗試時，先從最下層的小三角形開始檢查起。"
                    ),
                    "mediaType": "none"
                }
            })
        elif "multiplechoice" in msg_text:
            raw_remedial.append({
                "component": "ExplainerMedia",
                "data": {
                    "title": "觀念釐清：複雜度的本質",
                    "explanation": (
                        "關於演算法效率的選擇題答錯了，這通常是因為對『樹高』的概念還不夠熟悉。\n\n"
                        "Heap Sort 之所以穩定，是因為它強迫數據在一個高度只有 log n 的樹中移動。\n"
                        "這就像是在一個規劃完美的百貨公司找東西，比起亂逛（O(n^2)），效率是極大的提升。"
                    ),
                    "mediaType": "none"
                }
            })
        else:
            raw_remedial.append({
                "component": "ExplainerMedia",
                "data": {
                    "title": "小試身手：再次複習核心",
                    "explanation": "沒關係，學習演算法本來就需要反覆推敲。讓我們重新聚焦在這個章節的核心概念，再試一次！",
                    "mediaType": "none"
                }
            })

        # 將 raw data 包裝成完整的 LessonStage 結構
        stages = []
        for idx, r in enumerate(raw_remedial):
            stages.append({
                "stageId": f"remedial-{idx}",
                "topic": "補救教學",
                "component": r["component"],
                "skin": "Scientific",
                "config": {"data": r["data"], "initialState": {}},
                "validation": {"type": "logic", "condition": None},
                "feedback": {"success": "太棒了！", "error": "請再試一次。"}
            })
            
        return schema.model_validate({"stages": stages})

    def _mock_feynman_round(self, schema: Type[BaseModel], messages: List[Any]) -> BaseModel:
        # --- 費曼教學小抄 (可以直接複製貼上測試) ---
        # 第 1 輪回答建議：
        # 「你可以把資料想成一棵每個父節點都不小於子節點的樹，這就是最大堆積。最大值會一直待在樹頂；我們把它換到陣列最後，再把剩下的資料重新整理。重複這件事，最大值會從後面開始依序就位，最後整個陣列便由小到大排好。」
        #
        # 第 2 輪回答建議：
        # 「最小堆積也能排序，但它每次拿到的是最小值，通常要額外安排輸出位置。最大堆積的最大值正好可以直接放到陣列尚未排序區域的最後一格；那一格之後不用再碰，所以能在原陣列內完成由小到大的排序。」
        #
        # 第 3 輪回答建議：
        # 「這時會做『向下調整』。把新的根節點和兩個子節點中較大的那一個比較；如果子節點比較大就交換，讓較大的值一路往上。一直做到父節點不小於任何子節點，或走到最底層，最大堆積就修復了。」
        #
        # 第 4 輪回答建議：
        # 「Heap Sort 的優勢是最壞情況也保證 O(n log n)，而且只需要 O(1) 額外空間。但它不是穩定排序，相同值的原始順序可能改變；樹狀跳躍存取也比較不利於 CPU 快取。所以需要穩定性時常選 Merge Sort，而一般資料下追求平均速度時常選 Quick Sort。」
        # ---------------------------------------

        # 第 1 輪考點：最大堆積的基本直覺與排序流程
        # 第 2 輪考點：最大堆積與由小到大排序的關係
        # 第 3 輪考點：Heapify 維護機制 (當根節點被換掉後，如何恢復堆積屬性？)
        # 第 4 輪考點：實務取捨 (最壞情況、穩定性與快取效能)
        
        responses = [
            {
                "reply": "原來如此！所以堆積排序是利用『最大堆積』來運作。但我想確認一下，如果我要由小到大排序，為什麼不直接用『最小堆積』，而是要把最大的元素不斷換到陣列最後面呢？", 
                "isSatisfied": False
            },
            {
                "reply": "我懂了！那當我把根節點（最大值）換到最後面後，新的根節點可能會破壞堆積的屬性，這時候系統會進行什麼操作來修復它？你能解釋一下這個『向下調整 (Heapify)』的過程嗎？", 
                "isSatisfied": False
            },
            {
                "reply": "聽起來很有效率！你提到它的最壞情況也是 O(n log n)，這比快速排序穩定多了。但既然它這麼強，為什麼在實際應用中，大家有時候還是更偏好合併排序或快速排序？它有什麼弱點嗎？", 
                "isSatisfied": False
            },
            {
                "reply": "我完全明白了！雖然堆積排序空間效率極高且時間穩定，但它不是『穩定排序』，而且記憶體存取的不連續性會影響快取效能。謝謝你的詳細解釋，我對堆積排序有信心了！", 
                "isSatisfied": True
            }
        ]
        # 根據目前的對話輪數決定回傳哪一個 Mock 回應
        # messages 通常包含 [System, Assistant(Goal), User(1), Assistant(1), User(2)...]
        # 第一輪 User 互動時 len(messages) = 3 (System, Assistant, User)
        # 所以 round_idx = (3 - 2) // 2 = 0，回傳 responses[0]
        round_idx = (len(messages) - 2) // 2
        data = responses[min(max(0, round_idx), len(responses)-1)]
        return schema.model_validate(data)

    def _mock_questionnaire(self, schema: Type[BaseModel]) -> BaseModel:
        data = {
            "questions": [
                {"id": "q1", "text": "你的程式撰寫經驗大約多久？", "type": "choice", "options": ["完全沒有經驗", "1 年以內 (初學者)", "1-3 年 (有基礎實戰)", "3 年以上 (資深開發者)"]},
                {"id": "q2", "text": "你對「時間複雜度 (Big-O)」的理解程度？", "type": "choice", "options": ["完全沒聽過這個詞", "聽過概念但不會分析", "能理解基礎 (如線性/平方)", "能分析複雜遞迴與動態規劃"]},
                {"id": "q3", "text": "你學習演算法的主要目的是？", "type": "choice", "options": ["求職面試 (LeetCode 衝刺)", "大學課程/考試準備", "優化工作專案的效能", "純粹對邏輯與數學感興趣"]},
                {"id": "q4", "text": "你比較喜歡哪種教學風格？", "type": "choice", "options": ["大量動畫與圖解視覺化", "數學公式與嚴謹理論證明", "著重在實際程式碼實作", "高強度的實戰演練與測驗"]}
            ]
        }
        return schema.model_validate(data)

    def _mock_blueprint(self, schema: Type[BaseModel]) -> BaseModel:
        data = {
            "courseTitle": "演算法設計與分析",
            "description": "掌握高效解決問題的藝術。",
            "units": [
                {
                    "unitId": "u1", "unitTitle": "演算法基礎與數學", "unitDescription": "基本原則與複雜度分析。",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in ALGO_NODES_DATA[0:13]]
                },
                {
                    "unitId": "u2", "unitTitle": "排序演算法與分治法", "unitDescription": "遞迴式的解決範式。",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in ALGO_NODES_DATA[13:21]]
                },
                {
                    "unitId": "u3", "unitTitle": "貪婪策略", "unitDescription": "局部最佳化的應用。",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in ALGO_NODES_DATA[21:28]]
                },
                {
                    "unitId": "u4", "unitTitle": "動態規劃 (DP)", "unitDescription": "子問題的最佳化處理。",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in ALGO_NODES_DATA[28:42]]
                },
                {
                    "unitId": "u5", "unitTitle": "圖形與樹狀搜尋", "unitDescription": "平衡樹與廣度/深度優先搜尋。",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in ALGO_NODES_DATA[42:47]]
                },
                {
                    "unitId": "u6", "unitTitle": "計算複雜度理論 (NP)", "unitDescription": "P, NP 與問題化簡。",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in ALGO_NODES_DATA[47:]]
                }
            ]
        }
        return schema.model_validate(data)

    def _mock_unit_expansion(self, schema: Type[BaseModel], msg_text: str) -> BaseModel:
        nodes = ALGO_NODES_DATA[0:6]
        if "greedy" in msg_text: nodes = ALGO_NODES_DATA[13:21]
        elif "dp" in msg_text or "dynamic" in msg_text: nodes = ALGO_NODES_DATA[28:42]
        elif "np" in msg_text: nodes = ALGO_NODES_DATA[47:]
        
        data = {"nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked", "hasGeneratedLesson": True} for n in nodes]}
        return schema.model_validate(data)

    def _mock_lesson_content(self, schema: Type[BaseModel], msg_text: str, user_id: int = 1) -> BaseModel:
        target_node = ALGO_NODES_DATA[0]
        for node in ALGO_NODES_DATA:
            if node["title"].lower() in msg_text or node["id"].lower() in msg_text:
                target_node = node
                break
        
        stages = []
        for idx, s in enumerate(target_node["stages"]):
            stages.append({
                "stageId": f"{target_node['id']}-s{idx}",
                "topic": target_node["topic"] if "topic" in target_node else target_node["title"],
                "component": s["component"],
                "skin": "Scientific",
                "config": {
                    "data": s["data"].copy(),
                    # Competition-only UI script. The browser turns this deterministic
                    # plan plus actual answers/hints into the live Neuro experience.
                    # It deliberately lives in initialState so component data validators
                    # and answer evaluators keep receiving their normal stage payload.
                    "initialState": {"neuroExperience": self._mock_neuro_experience(target_node, idx, s["component"])},
                },
                "validation": {"type": "logic", "condition": None},
                "feedback": {"success": "太棒了！", "error": "請再試一次。"}
            })
            
            # Patch mediaUrl if it's a course image
            stage_data = stages[-1]["config"]["data"]
            if stage_data.get("mediaUrl") and "/files/images/1/" in stage_data["mediaUrl"]:
                stage_data["mediaUrl"] = stage_data["mediaUrl"].replace("/files/images/1/", f"/files/images/{user_id}/")
        
        if "stages" in getattr(schema, "model_fields", {}):
            return schema.model_validate({"stages": stages})
        return schema.model_validate(stages[0] if stages else {})

    def _mock_neuro_experience(self, node: dict, stage_index: int, component: str) -> dict:
        """A repeatable competition script, not a physiological claim or LLM response."""
        palette = ["aurora", "comet", "prism", "sunrise", "orbit"][stage_index % 5]
        return {
            "version": "competition-neuro-v1",
            "seed": 20261017 + stage_index,
            "nodeId": node["id"],
            "stageIndex": stage_index,
            "component": component,
            "onboarding": stage_index == 0,
            "baselineSeconds": 8,
            "visualMode": palette,
            "title": node["title"],
            "objective": f"掌握 {node['title']} 的核心步驟",
            "beats": {
                "correct": "focused_burst",
                "incorrect": "frustration_wave",
                "hint": "recovery_stream",
                "secondIncorrect": "alternate_route",
            },
            "alternate": {
                "label": "視覺化拆解模式",
                "headline": f"把 {node['title']} 拆成一條看得見的路徑",
                "detail": "這是比賽展示用的替代呈現；原題與原本的計分流程仍保留。",
            },
        }

    def _mock_learner_profile(self, schema: Type[BaseModel]) -> BaseModel:
        return schema.model_validate({"summary": "專業資訊背景。", "attributes": {"background": "資訊技術", "pace": "快速", "focus": "演算法實作", "level": "進階中級"}})
