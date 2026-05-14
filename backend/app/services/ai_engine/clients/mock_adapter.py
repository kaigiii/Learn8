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
        ("algo-1-1", "Heap Sort", "Binary heap based sorting.", "tree"),
        ("algo-1-2", "Iterative Algorithms", "Selection Sort example.", "sorting"),
        ("algo-1-3", "Recursive Algorithms", "Factorial & Fibonacci.", "tree"),
        ("algo-1-4", "Pseudo-code Standards", "Assignment & Loops.", "logic"),
        ("algo-1-5", "ADT Concepts", "Stacks & Queues.", "logic"),
        ("algo-1-6", "Performance Analysis", "Intro to efficiency.", "logic"),
        # Chapter 2
        ("algo-2-1", "Big-O Notation", "Upper bounds.", "search"),
        ("algo-2-2", "Omega Notation", "Lower bounds.", "search"),
        ("algo-2-3", "Theta Notation", "Tight bounds.", "search"),
        ("algo-2-4", "Growth Rate Comparison", "Comparing efficiency classes.", "logic"),
        ("algo-2-5", "Amortized Analysis", "Average over time.", "logic"),
        ("algo-2-6", "Master Theorem: Intro", "Recurrence equations.", "tree"),
        ("algo-2-7", "Master Theorem: Cases", "Solving recurrences.", "tree"),
        # Chapter 3
        ("algo-3-1", "Greedy Foundation", "Optimal substructure.", "logic"),
        ("algo-3-2", "Fractional Knapsack", "Continuous item selection.", "sorting"),
        ("algo-3-3", "Job Sequencing", "Profit with deadlines.", "sorting"),
        ("algo-3-4", "Huffman: Tree Building", "Frequency based merging.", "tree"),
        ("algo-3-5", "Huffman: Encoding", "Prefix-free binary codes.", "tree"),
        ("algo-3-6", "Prim's Algorithm", "MST growth.", "graph"),
        ("algo-3-7", "Kruskal's Algorithm", "MST sorting edges.", "graph"),
        # Chapter 4
        ("algo-4-1", "D&C Paradigm", "Divide, Conquer, Combine.", "tree"),
        ("algo-4-2", "Binary Search", "O(log n) search.", "search"),
        ("algo-4-3", "Merge Sort", "Recursive splitting and merging.", "sorting"),
        ("algo-4-4", "Quick Sort", "Pivot partitioning.", "sorting"),
        ("algo-4-5", "Strassen's Matrix", "Faster multiplication.", "tree"),
        ("algo-4-6", "Median Finding", "Linear selection.", "sorting"),
        ("algo-4-7", "Closest Pair", "Divide and conquer geometry.", "tree"),
        # Chapter 5
        ("algo-5-1", "BFS Strategy", "Level-order traversal.", "graph"),
        ("algo-5-2", "DFS Strategy", "Depth-order traversal.", "graph"),
        ("algo-5-3", "Topological Sort", "Dependency ordering.", "graph"),
        ("algo-5-4", "BST Operations", "Binary tree logic.", "tree"),
        ("algo-5-5", "AVL Trees", "Self-balancing rotations.", "tree"),
        ("algo-5-6", "Red-Black Trees", "Color properties.", "tree"),
        ("algo-5-7", "B-Trees", "Disk-optimized search.", "tree"),
        # Chapter 6
        ("algo-6-1", "State Space Tree", "Backtracking basics.", "tree"),
        ("algo-6-2", "N-Queens Problem", "Backtracking search.", "tree"),
        ("algo-6-3", "Sum of Subsets", "Subsets that sum to K.", "tree"),
        ("algo-6-4", "Graph Coloring", "Assigning colors.", "graph"),
        ("algo-6-5", "Hamiltonian Cycle", "Path through all vertices.", "graph"),
        ("algo-6-6", "Branch and Bound", "Optimal pruning.", "tree"),
        # Chapter 7
        ("algo-7-1", "DP Foundations", "Memoization vs Tabulation.", "logic"),
        ("algo-7-2", "0/1 Knapsack (DP)", "Subproblem table.", "logic"),
        ("algo-7-3", "LCS Problem", "Sequence alignment.", "logic"),
        ("algo-7-4", "Matrix Chain Mult", "Optimal order.", "logic"),
        ("algo-7-5", "Floyd-Warshall", "All-pairs shortest path.", "graph"),
        ("algo-7-6", "Bellman-Ford", "Negative edge weights.", "graph"),
        ("algo-7-7", "Edit Distance", "String transformation.", "logic"),
        # Chapter 8
        ("algo-8-1", "Complexity Classes", "P vs NP.", "search"),
        ("algo-8-2", "Polynomial Reductions", "Hardness proof.", "logic"),
        ("algo-8-3", "Cook's Theorem", "SAT completeness.", "logic"),
        ("algo-8-4", "3-SAT Problem", "Simplified SAT.", "logic"),
        ("algo-8-5", "Clique Problem", "Complete subgraphs.", "graph"),
        ("algo-8-6", "Approximation Algos", "Dealing with NP-hard.", "logic"),
    ]

    nodes = []
    for node_id, title, desc, vibe in raw_nodes:
        stages = [
            # Stage 1: Simulator
            {
                "component": "HeapSortSimulator" if title == "Heap Sort" else "ExplainerMedia",
                "data": {
                    "vibe": vibe,
                    "title": f"{title} 互動模擬器" if title == "Heap Sort" else f"{title} 核心概念說明",
                    "initialArray": [12, 15, 10, 5, 8, 7] if title == "Heap Sort" else None,
                    "explanation": "堆積排序 (Heap Sort) 的核心在於利用『二元堆積』。觀察最大值是如何從樹根被提取，且樹結構如何自動恢復屬性。" if title == "Heap Sort" else f"理解 {title} 的運作邏輯。",
                    "messages": {
                        "ready": "準備就緒。點擊「運行模擬」開始觀察 Heapify 過程。",
                        "building": "第一步：從最後一個非葉子節點開始，自底向上建立最大堆積...",
                        "sorting": "第二步：不斷將根節點與末尾交換，並縮小堆積範圍重新調整...",
                        "done": "完成！數組現在已完全由小到大排列。"
                    } if title == "Heap Sort" else None,
                    "mediaType": "none",
                }
            },
            # Stage 2: Exercise
            {
                "component": "HeapSortExercise" if title == "Heap Sort" else "MultipleChoice",
                "data": {
                    "title": "實戰練習：動手排序！",
                    "initialArray": [9, 14, 11, 6, 12, 7],
                    "explanation": "請先修復違規節點建立『最大堆積』，然後點擊根節點進行提取排序。",
                    "messages": {
                        "initial": "請找出違反『父節點 ≥ 子節點』屬性的位置進行交換。",
                        "successSwap": "調整正確！繼續檢查其他節點。",
                        "successExtract": "提取成功！最大值已歸位。",
                        "errorSwap": "警告：交換後的父節點必須是大於子節點的。",
                        "errorInvalid": "非法操作：請先建立堆積或點擊正確的交換目標。"
                    },
                    "hints": [
                        "提示 1：從 index 2 的節點開始檢查它的子節點。",
                        "提示 2：14 目前比它的父節點大，應該進行交換。",
                        "提示 3：建立完堆積後，記得點擊根節點 (index 0) 與最後一個葉子交換。"
                    ]
                } if title == "Heap Sort" else {
                    "question": f"What is the primary goal of {title}?",
                    "options": [{"id": "a", "text": "Efficiency"}, {"id": "b", "text": "Accuracy"}],
                    "correctOptionId": "a"
                }
            },
            # Stage 3: Complexity Analysis (ExplainerMedia)
            {
                "component": "ExplainerMedia",
                "data": {
                    "title": "效能分析：Heap Sort 的複雜度",
                    "explanation": "Heap Sort 是一個非常穩定的演算法。無論在最好、最壞還是平均情況下，它的時間複雜度都是 O(n log n)。這是因為建堆積需要 O(n)，而進行 n 次提取最大值每次需要 O(log n)。此外，它是『就地排序 (In-place)』，空間複雜度僅為 O(1)。",
                    "mediaType": "image" if title == "Heap Sort" else "none",
                    "mediaUrl": "/api/v1/courses/files/images/1/heap-sort-assets/heap-sort-complexity.png" if title == "Heap Sort" else None,
                }
            },
            # Stage 4: Complexity Quiz (MultipleChoice)
            {
                "component": "MultipleChoice",
                "data": {
                    "question": "為什麼 Heap Sort 在最壞情況下的時間複雜度仍能維持在 O(n log n)？",
                    "options": [
                        {"id": "a", "text": "因為它使用了額外的輔助數組"},
                        {"id": "b", "text": "因為二元堆積的高度始終維持在 log n，且調整過程是確定的"},
                        {"id": "c", "text": "因為它像 Quick Sort 一樣使用了隨機化基準點"},
                        {"id": "d", "text": "因為它不需要進行比較"}
                    ],
                    "correctOptionId": "b"
                }
            },
            # Stage 5: Feynman Teaching
            {
                "component": "FeynmanMirror",
                "data": {
                    "topic": title,
                    "goal": f"試著向一個完全不懂演算法的人解釋：為什麼 Heap Sort 就像是從一堆數字中，不斷找出最大的那個放在最後面，但又能保持效率？",
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
        return "Mock response from Learn8 Algorithm Specialist."

    async def generate_structured(self, messages: List[Any], schema: Type[BaseModel], **kwargs) -> BaseModel:
        await asyncio.sleep(1.0)
        msg_text = str(messages).lower()
        fields = getattr(schema, "model_fields", getattr(schema, "__fields__", {})).keys()

        if "questions" in fields and "summary" not in fields and "stages" not in fields and "nodes" not in fields:
            return self._mock_questionnaire(schema)
            
        if "summary" in fields and "attributes" in fields:
            return self._mock_learner_profile(schema)

        if "courseTitle" in fields and "units" in fields:
            return self._mock_blueprint(schema)
            
        if "nodes" in fields:
            return self._mock_unit_expansion(schema, msg_text)

        if "stages" in fields or "component" in fields:
            user_id = kwargs.get("user_id", 1)
            return self._mock_lesson_content(schema, msg_text, user_id=user_id)
        
        if "reply" in fields and "isSatisfied" in fields:
            return self._mock_feynman_round(schema, messages)

        if "isCorrect" in fields:
            return schema.model_validate({"isCorrect": True, "feedback": "Excellent explanation!"})
            
        return schema.model_construct()

    def _mock_feynman_round(self, schema: Type[BaseModel], messages: List[Any]) -> BaseModel:
        responses = [
            {"reply": "所以動態規劃基本上就是把算過的答案記下來，避免重複工作，對吧？", "isSatisfied": False},
            {"reply": "我懂了！透過表格化（Tabulation）我們可以更有系統地解決複雜問題。謝謝！", "isSatisfied": True}
        ]
        round_idx = (len(messages) - 1) // 2
        data = responses[min(round_idx, len(responses)-1)]
        return schema.model_validate(data)

    def _mock_questionnaire(self, schema: Type[BaseModel]) -> BaseModel:
        data = {
            "questions": [
                {"id": "q1", "text": "你的專業背景？", "type": "choice", "options": ["醫學", "資訊", "商業", "人文"]},
                {"id": "q2", "text": "學習步調？", "type": "choice", "options": ["快速", "穩定", "深度"]},
                {"id": "q3", "text": "熟悉程度？", "type": "choice", "options": ["陌生", "基礎", "專業"]},
                {"id": "q4", "text": "難度？", "type": "choice", "options": ["科普", "實務", "學術"]}
            ]
        }
        return schema.model_validate(data)

    def _mock_blueprint(self, schema: Type[BaseModel]) -> BaseModel:
        data = {
            "courseTitle": "Algorithm Design & Analysis",
            "description": "Master the art of efficient problem solving.",
            "units": [
                {
                    "unitId": "u1", "unitTitle": "Foundations & Math", "unitDescription": "Basic principles and Complexity.",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in ALGO_NODES_DATA[0:13]]
                },
                {
                    "unitId": "u2", "unitTitle": "Sorting & D&C", "unitDescription": "Recursive paradigms.",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in ALGO_NODES_DATA[13:21]]
                },
                {
                    "unitId": "u3", "unitTitle": "Greedy Strategies", "unitDescription": "Local optimization.",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in ALGO_NODES_DATA[21:28]]
                },
                {
                    "unitId": "u4", "unitTitle": "Dynamic Programming", "unitDescription": "Subproblem optimization.",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in ALGO_NODES_DATA[28:42]]
                },
                {
                    "unitId": "u5", "unitTitle": "Graph & Tree Search", "unitDescription": "Balanced Trees and BFS/DFS.",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in ALGO_NODES_DATA[42:47]]
                },
                {
                    "unitId": "u6", "unitTitle": "Theory of NP", "unitDescription": "P, NP, and Reductions.",
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
                "feedback": {"success": "Excellent!", "error": "Please try again."}
            })
            
            # Patch mediaUrl if it's a course image
            stage_data = stages[-1]["config"]["data"]
            if stage_data.get("mediaUrl") and "/files/images/1/" in stage_data["mediaUrl"]:
                stage_data["mediaUrl"] = stage_data["mediaUrl"].replace("/files/images/1/", f"/files/images/{user_id}/")
        
        if "stages" in getattr(schema, "model_fields", {}):
            return schema.model_validate({"stages": stages})
        return schema.model_validate(stages[0] if stages else {})

    def _mock_learner_profile(self, schema: Type[BaseModel]) -> BaseModel:
        return schema.model_validate({"summary": "專業背景。", "attributes": {"background": "Technical", "pace": "Fast", "focus": "Algorithm", "level": "Intermediate"}})
