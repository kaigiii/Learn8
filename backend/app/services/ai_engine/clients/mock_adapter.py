import asyncio
import json
import logging
from typing import Any, List, Type, Optional
from pydantic import BaseModel
from app.services.ai_engine.clients.base_provider import BaseLLMProvider

logger = logging.getLogger(__name__)

# --- 全量心血管系統教學數據 (15 節點，全部標準化為 4 個選項/步驟/配對) ---
HEART_NODES_DATA = [
    {
        "id": "heart-1-1", 
        "title": "CVS Overview", 
        "description": "Foundations of circulation and heart mechanics.",
        "stages": [
            {
                "component": "ExplainerMedia", 
                "data": {
                    "title": "The Closed Circuit", 
                    "explanation": "The Cardiovascular System is a closed circuit composed of the heart and vessels.",
                    "bullets": ["Pulmonary: To lungs", "Systemic: To body", "Function: Delivery", "Waste: Removal"],
                    "mediaType": "image", "mediaUrl": "/images/heart/overview.png"
                }
            },
            {
                "component": "BloodFlowSimulator",
                "data": {
                    "question": "Trace the path of blood through the Right Heart:",
                    "steps": [
                        {"id": "ra", "label": "Right Atrium", "type": "chamber"},
                        {"id": "tv", "label": "Tricuspid Valve", "type": "valve"},
                        {"id": "rv", "label": "Right Ventricle", "type": "chamber"},
                        {"id": "pv", "label": "Pulmonary Valve", "type": "valve"}
                    ]
                }
            },
            {
                "component": "MultipleChoice", 
                "data": {
                    "question": "What is the primary goal of the Pulmonary circulation?", 
                    "options": [
                        {"id": "a", "text": "Deliver nutrients"}, {"id": "b", "text": "Eliminate CO2"},
                        {"id": "c", "text": "Pump to brain"}, {"id": "d", "text": "Regulate temp"}
                    ], 
                    "correctOptionId": "b"
                }
            }
        ]
    },
    {
        "id": "heart-1-2", "title": "Heart Overview", "description": "Size, mass, and location.", 
        "stages": [
            {
                "component": "MultipleChoice",
                "data": {
                    "question": "Where is the heart located?",
                    "options": [
                        {"id": "1", "text": "Pleural cavity"}, {"id": "2", "text": "Mediastinum"},
                        {"id": "3", "text": "Abdominal cavity"}, {"id": "4", "text": "Pelvic cavity"}
                    ],
                    "correctOptionId": "2"
                }
            },
            {
                "component": "MatchingPairs",
                "data": {
                    "question": "Match heart anatomy with size/location:",
                    "pairs": [
                        {"id": "m1", "left": "Base", "right": "Upper border"},
                        {"id": "m2", "left": "Apex", "right": "Lower pointed end"},
                        {"id": "m3", "left": "Size", "right": "Size of a fist"},
                        {"id": "m4", "left": "Mass", "right": "250g to 350g"}
                    ]
                }
            }
        ]
    },
    {
        "id": "heart-1-3", "title": "External Anatomy", "description": "Base, Apex, and surfaces.", 
        "stages": [
            {
                "component": "Ordering",
                "data": {
                    "question": "Order the surfaces of the heart from top to bottom:",
                    "steps": ["Base (Posterior)", "Anterior Surface", "Diaphragmatic Surface", "Apex"]
                }
            }
        ]
    },
    {
        "id": "heart-1-4", "title": "Pericardium", "description": "The protective sac.", 
        "stages": [
            {
                "component": "MatchingPairs",
                "data": {
                    "question": "Match the pericardial layers:",
                    "pairs": [
                        {"id": "l1", "left": "Fibrous", "right": "Outer tough layer"},
                        {"id": "l2", "left": "Parietal", "right": "Outer serous layer"},
                        {"id": "l3", "left": "Visceral", "right": "Inner serous layer"},
                        {"id": "l4", "left": "Cavity", "right": "Contains serous fluid"}
                    ]
                }
            }
        ]
    },
    {
        "id": "heart-1-5", "title": "Heart Wall Layers", "description": "Epicardium, Myocardium, Endocardium.", 
        "stages": [
            {
                "component": "Ordering",
                "data": {
                    "question": "Order the heart wall layers from Outer to Inner:",
                    "steps": ["Epicardium", "Myocardium", "Endocardium", "Heart Chamber"]
                }
            },
            {
                "component": "MultipleChoice",
                "data": {
                    "question": "Which layer is responsible for the pumping action?",
                    "options": [
                        {"id": "a", "text": "Epicardium"}, {"id": "b", "text": "Myocardium"},
                        {"id": "c", "text": "Endocardium"}, {"id": "d", "text": "Pericardium"}
                    ],
                    "correctOptionId": "b"
                }
            }
        ]
    },
    {
        "id": "heart-1-6", "title": "Right Atrium", "description": "Entry point for deoxygenated blood.",
        "stages": [
            {
                "component": "MultipleChoice",
                "data": {
                    "question": "Which vein does NOT drain into the right atrium?",
                    "options": [
                        {"id": "1", "text": "Superior Vena Cava"}, {"id": "2", "text": "Pulmonary Vein"},
                        {"id": "3", "text": "Inferior Vena Cava"}, {"id": "4", "text": "Coronary Sinus"}
                    ],
                    "correctOptionId": "2"
                }
            },
            {
                "component": "MatchingPairs",
                "data": {
                    "question": "Match RA features:",
                    "pairs": [
                        {"id": "r1", "left": "Fossa Ovalis", "right": "Fetal remnant"},
                        {"id": "r2", "left": "Pectinate Muscles", "right": "Muscular ridges"},
                        {"id": "r3", "left": "Tricuspid Valve", "right": "Exit to RV"},
                        {"id": "r4", "left": "Auricle", "right": "Expandable pouch"}
                    ]
                }
            }
        ]
    },
    {
        "id": "heart-1-7", "title": "Right Ventricle", "description": "Pumping to lungs.",
        "stages": [
            {
                "component": "BloodFlowSimulator",
                "data": {
                    "question": "Trace the path out of the RV:",
                    "steps": [
                        {"id": "ca", "label": "Conus Arteriosus", "type": "chamber"},
                        {"id": "psv", "label": "Pulmonary Valve", "type": "valve"},
                        {"id": "pt", "label": "Pulmonary Trunk", "type": "vessel"},
                        {"id": "pa", "label": "Pulmonary Arteries", "type": "vessel"}
                    ]
                }
            }
        ]
    },
    {
        "id": "heart-1-8", "title": "Left Atrium & Ventricle", "description": "Systemic output.",
        "stages": [
            {
                "component": "MultipleChoice",
                "data": {
                    "question": "Why is the LV wall thicker than the RV wall?",
                    "options": [
                        {"id": "a", "text": "Higher pressure demand"}, {"id": "b", "text": "Larger blood volume"},
                        {"id": "c", "text": "Contains more valves"}, {"id": "d", "text": "Faster heart rate"}
                    ],
                    "correctOptionId": "a"
                }
            },
            {
                "component": "Ordering",
                "data": {
                    "question": "Trace systemic exit path:",
                    "steps": ["Left Ventricle", "Aortic Valve", "Ascending Aorta", "Aortic Arch"]
                }
            }
        ]
    },
    {
        "id": "heart-1-9", "title": "Heart Valves", "description": "Ensuring one-way flow.",
        "stages": [
            {
                "component": "MatchingPairs",
                "data": {
                    "question": "Match the valves:",
                    "pairs": [
                        {"id": "v1", "left": "Mitral", "right": "Bicuspid AV valve"},
                        {"id": "v2", "left": "Tricuspid", "right": "Right AV valve"},
                        {"id": "v3", "left": "Aortic", "right": "Left semilunar"},
                        {"id": "v4", "left": "Pulmonary", "right": "Right semilunar"}
                    ]
                }
            }
        ]
    },
    {
        "id": "heart-1-10", "title": "Coronary Circulation", "description": "Heart's own blood supply.",
        "stages": [
            {
                "component": "MultipleChoice",
                "data": {
                    "question": "First branches of the aorta?",
                    "options": [
                        {"id": "1", "text": "Carotid arteries"}, {"id": "2", "text": "Coronary arteries"},
                        {"id": "3", "text": "Subclavian arteries"}, {"id": "4", "text": "Brachial arteries"}
                    ],
                    "correctOptionId": "2"
                }
            }
        ]
    },
    {
        "id": "heart-1-11", "title": "Sulci & Skeleton", "description": "Surface grooves.", "stages": []},
    {
        "id": "heart-1-12", "title": "Nerve Supply", "description": "Autonomic control.", "stages": []},
    {
        "id": "heart-1-13", "title": "Conduction System", "description": "Pacemaker logic.",
        "stages": [
            {
                "component": "Ordering",
                "data": {
                    "question": "Order the conduction sequence:",
                    "steps": ["SA Node", "AV Node", "Bundle of His", "Purkinje Fibers"]
                }
            }
        ]
    },
    {
        "id": "heart-1-14", "title": "Cardiac Cycle", "description": "Systole and Diastole.",
        "stages": [
            {
                "component": "MultipleChoice",
                "data": {
                    "question": "What happens during Ventricular Systole?",
                    "options": [
                        {"id": "1", "text": "Atria contract"}, {"id": "2", "text": "Ventricles contract"},
                        {"id": "3", "text": "Ventricles relax"}, {"id": "4", "text": "AV valves open"}
                    ],
                    "correctOptionId": "2"
                }
            }
        ]
    },
    {
        "id": "heart-1-15", "title": "Heart Sounds", "description": "Lubb-Dupp sounds.", "stages": []}
]

class MockLLMProvider(BaseLLMProvider):
    def __init__(self):
        super().__init__()

    def bind_files(self, files: List[str]) -> "BaseLLMProvider":
        return self

    async def generate_text(self, messages: List[Any], **kwargs) -> str:
        await asyncio.sleep(0.5)
        return "Mock response from Learn8 Specialist."

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
            {"reply": "心臟就像兩個獨立但同步運作的幫浦，對吧？", "isSatisfied": False},
            {"reply": "我明白了！效率非常高。謝謝你的解釋！", "isSatisfied": True}
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
            "courseTitle": "Cardiovascular System",
            "description": "Deep dive into the heart.",
            "units": [
                {
                    "unitId": "u1", "unitTitle": "Foundations", "unitDescription": "Basics.",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in HEART_NODES_DATA[0:3]]
                },
                {
                    "unitId": "u2", "unitTitle": "Anatomy", "unitDescription": "Structure.",
                    "nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked"} for n in HEART_NODES_DATA[3:6]]
                }
            ]
        }
        return schema.model_validate(data)

    def _mock_unit_expansion(self, schema: Type[BaseModel], msg_text: str) -> BaseModel:
        nodes = HEART_NODES_DATA[0:3]
        if "anatomy" in msg_text: nodes = HEART_NODES_DATA[3:6]
        data = {"nodes": [{"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked", "hasGeneratedLesson": True} for n in nodes]}
        return schema.model_validate(data)

    def _mock_lesson_content(self, schema: Type[BaseModel], msg_text: str) -> BaseModel:
        target_node = HEART_NODES_DATA[0]
        for node in HEART_NODES_DATA:
            if node["title"].lower() in msg_text:
                target_node = node
                break
        
        stages = []
        for idx, s in enumerate(target_node["stages"]):
            stages.append({
                "stageId": f"{target_node['id']}-s{idx}",
                "topic": target_node["title"],
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
        return schema.model_validate({"summary": "專業背景。", "attributes": {"background": "Technical", "pace": "Fast", "focus": "Clinical", "level": "Intermediate"}})
