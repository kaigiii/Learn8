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
        # Special data for Heap Sort
        hierarchy_nodes = [
            {
                "id": "root", 
                "label": "Max-Heap: 13", 
                "type": "decision-node",
                "data": {"content": "這是堆積的根節點，存儲當前最大值。"},
                "children": ["l1", "r1"]
            },
            {
                "id": "l1", 
                "label": "11", 
                "type": "decision-node",
                "data": {"content": "左子樹節點。"},
                "children": ["l2", "r2"]
            },
            {
                "id": "r1", 
                "label": "12", 
                "type": "decision-node",
                "data": {"content": "右子樹節點。"},
                "children": ["l3"]
            },
            {
                "id": "l2", "label": "5", "type": "base-case", "data": {"content": "葉子節點。"}, "children": []
            },
            {
                "id": "r2", "label": "6", "type": "base-case", "data": {"content": "葉子節點。"}, "children": []
            },
            {
                "id": "l3", "label": "7", "type": "base-case", "data": {"content": "葉子節點。"}, "children": []
            }
        ] if title == "Heap Sort" else [
            {
                "id": "root", 
                "label": title, 
                "type": "array-slice" if vibe == "sorting" else "decision-node",
                "data": {"content": f"這是 {title} 的頂層問題。"},
                "children": ["left", "right"]
            },
            {
                "id": "left", 
                "label": f"{title} Part A", 
                "type": "array-slice" if vibe == "sorting" else "decision-node",
                "data": {"content": "左側子問題展開中..."},
                "children": []
            },
            {
                "id": "right", 
                "label": f"{title} Part B", 
                "type": "array-slice" if vibe == "sorting" else "decision-node",
                "data": {"content": "右側子問題展開中..."},
                "children": []
            }
        ]

        stages = [
            # Stage 1: Specialized Heap Sort Simulator (The "Spirit")
            {
                "component": "HeapSortSimulator" if title == "Heap Sort" else "ExplainerMedia",
                "data": {
                    "vibe": vibe,
                    "title": f"{title} 互動模擬器" if title == "Heap Sort" else f"{title} 核心概念說明",
                    "initialArray": [13, 11, 12, 5, 6, 7] if title == "Heap Sort" else None,
                    "explanation": "堆積排序 (Heap Sort) 的核心在於利用『二元堆積』。請點擊下方的『開始模擬』，觀察最大值是如何從樹根被提取並放到數組末尾，且樹結構如何通過交換動畫自動恢復堆積屬性。" if title == "Heap Sort" else f"在 {title} 的學習過程中，理解其運作邏輯是關鍵。接下來我們將透過一系列的互動挑戰來掌握它的核心。",
                    "mediaType": "none",
                }
            },
            # Stage 2: Basic MCQ
            {
                "component": "MultipleChoice",
                "data": {
                    "question": f"What is the primary goal of {title}?",
                    "options": [
                        {"id": "a", "text": "Efficiency"}, {"id": "b", "text": "Simplicity"},
                        {"id": "c", "text": "Accuracy"}, {"id": "d", "text": "None of the above"}
                    ],
                    "correctOptionId": "a"
                }
            },
            # Stage 3: Application (Ordering/Matching)
            {
                "component": "Ordering" if "Sort" in title or "Building" in title else "MatchingPairs",
                "data": {
                    "question": f"Mastering {title} logic:",
                    "steps" if "Sort" in title or "Building" in title else "pairs": [
                        "Start the process", "Perform core logic", "Validate results", "Finish"
                    ] if "Sort" in title or "Building" in title else [
                        {"id": "p1", "left": "Input", "right": "Data"},
                        {"id": "p2", "left": "Process", "right": "Algorithm"},
                        {"id": "p3", "left": "Output", "right": "Solution"}
                    ]
                }
            },
            # Stage 4: Advanced MCQ
            {
                "component": "MultipleChoice",
                "data": {
                    "question": f"Consider a complex scenario of {title}. Which is true?",
                    "options": [
                        {"id": "1", "text": "It handles all cases"}, {"id": "2", "text": "It is optimized for time"},
                        {"id": "3", "text": "It is memory intensive"}, {"id": "4", "text": "All of the above"}
                    ],
                    "correctOptionId": "2"
                }
            },
            # Stage 5: Feynman Teaching
            {
                "component": "FeynmanMirror",
                "data": {
                    "topic": title,
                    "goal": f"Can you explain {title} to a beginner? Focus on the core intuition and its significance in algorithm design.",
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
            return self._mock_lesson_content(schema, msg_text)
        
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

    def _mock_lesson_content(self, schema: Type[BaseModel], msg_text: str) -> BaseModel:
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
                "config": {"data": s["data"], "initialState": {}},
                "validation": {"type": "logic", "condition": None},
                "feedback": {"success": "Excellent!", "error": "Please try again."}
            })
        
        if "stages" in getattr(schema, "model_fields", {}):
            return schema.model_validate({"stages": stages})
        return schema.model_validate(stages[0] if stages else {})

    def _mock_learner_profile(self, schema: Type[BaseModel]) -> BaseModel:
        return schema.model_validate({"summary": "專業背景。", "attributes": {"background": "Technical", "pace": "Fast", "focus": "Algorithm", "level": "Intermediate"}})
