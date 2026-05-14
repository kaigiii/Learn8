import asyncio
import json
import logging
from typing import Any, List, Type, Optional
from pydantic import BaseModel
from app.services.ai_engine.clients.base_provider import BaseLLMProvider

logger = logging.getLogger(__name__)

def generate_algo_nodes():
    """動態生成 53 個節點，第一關升級為參數化的 AlgoHierarchy 組件。"""
    raw_nodes = [
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
                        "2. 空間利用：它是典型的就地排序 (In-place)，額外空間複雜度僅為 O(1)。\n"
                        "3. 結構優勢：利用完全二元樹特性，讓每一次調整都嚴格控制在樹高範圍內。"
                    ),
                    "mediaType": "image" if title == "Heap Sort" or "Heap Sort" in title else "none",
                    "mediaUrl": "http://localhost:8000/api/v1/courses/files/public/heap-sort-complexity.png" if title == "Heap Sort" or "Heap Sort" in title else None,
                }
            },
            # Stage 4: Complexity Quiz (MultipleChoice)
            {
                "component": "MultipleChoice",
                "data": {
                    "question": "為什麼在處理大型數據集時，Heap Sort 的最壞情況表現往往比快速排序 (Quick Sort) 更可靠？",
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
                    "goal": f"挑戰：向一個只聽過氣泡排序 (Bubble Sort) 的人解釋：為什麼 Heap Sort 的『最大堆積』策略能讓排序速度從 O(n^2) 大幅躍升到 O(n log n)？",
                }
            }
        ]
        nodes.append({"id": node_id, "title": title, "description": desc, "stages": stages})
    return nodes

ALGO_NODES_DATA = generate_algo_nodes()

class MockLLMProvider(BaseLLMProvider):
    def __init__(self):
        super().__init__()

    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
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
        # 「因為最大堆積的根節點永遠是最大值，我們把它跟最後一個元素交換後，最大值就排到了正確的末尾位置。重複這個過程，就能由後往前建立起從小到大的排序，且不需要額外空間。」
        #
        # 第 2 輪回答建議：
        # 「我們會執行『向下調整 (Sift-Down)』。將新的根節點與其較大的子節點比較，如果子節點較大就交換，直到它不再小於子節點或成為葉子為止。這樣就能重新恢復最大堆積的屬性。」
        #
        # 第 3 輪回答建議：
        # 「因為 Heap Sort 的結構保證了每次提取最大值的代價都是固定的 O(log n)，不會像 Quick Sort 那樣因為基準點選得不好而退化成 O(n^2)。它能保證穩定的最壞情況效能。」
        #
        # 第 4 輪回答建議：
        # 「主要的弱點是它不具備『穩定性』，相同的元素順序可能會被打亂。另外，它在記憶體中的跳躍式存取對 CPU 快取不夠友善，所以在處理極大數據時，實際速度可能慢於 Merge Sort。」
        # ---------------------------------------

        # 第 1 輪考點：最大堆積與排序順序的關係 (為什麼由小到大排序要用最大堆積？)
        # 第 2 輪考點：Heapify 維護機制 (當根節點被換掉後，如何恢復堆積屬性？)
        # 第 3 輪考點：演算法穩定性與最壞情況 (為什麼 O(n log n) 在這裡比 Quick Sort 穩定？)
        # 第 4 輪考點：實務限制 (為什麼 Heap Sort 不是不穩定排序，且快取效能較差？)
        
        responses = [
            {
                "reply": "原來如此！所以 Heap Sort 是利用『最大堆積』來運作。但我想確認一下，如果我要由小到大排序，為什麼不直接用『最小堆積』，而是要把最大的元素不斷換到陣列最後面呢？", 
                "isSatisfied": False
            },
            {
                "reply": "我懂了！那當我把根節點（最大值）換到最後面後，新的根節點可能會破壞堆積的屬性，這時候系統會進行什麼操作來修復它？你能解釋一下這個『向下調整 (Heapify)』的過程嗎？", 
                "isSatisfied": False
            },
            {
                "reply": "聽起來很有效率！你提到它的最壞情況也是 O(n log n)，這比 Quick Sort 穩定多了。但既然它這麼強，為什麼在實際應用中（例如實作函式庫時），大家有時候還是更偏好 Merge Sort 或 Quick Sort？它有什麼弱點嗎？", 
                "isSatisfied": False
            },
            {
                "reply": "我完全明白了！雖然 Heap Sort 空間效率極高且時間穩定，但它不是『穩定排序 (Stable Sort)』，而且記憶體存取的不連續性會影響快取效能。謝謝你的詳細解釋，我對堆積排序有信心了！", 
                "isSatisfied": True
            }
        ]
        # 根據目前的對話輪數決定回傳哪一個 Mock 回應
        # messages 通常包含 [System, User, AI, User...]，所以輪數計算為 (len - 1) // 2
        round_idx = (len(messages) - 1) // 2
        data = responses[min(round_idx, len(responses)-1)]
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
                "config": {"data": s["data"].copy(), "initialState": {}},
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

    def _mock_learner_profile(self, schema: Type[BaseModel]) -> BaseModel:
        return schema.model_validate({"summary": "專業資訊背景。", "attributes": {"background": "資訊技術", "pace": "快速", "focus": "演算法實作", "level": "進階中級"}})
