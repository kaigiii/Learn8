import asyncio
import json
import logging
from typing import Any, List, Type, Optional
from pydantic import BaseModel
from app.services.llm_clients.base_provider import BaseLLMProvider

logger = logging.getLogger(__name__)

# --- 全量心血管系統教學數據 (15 節點) ---
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
                    "explanation": "The Cardiovascular System is a closed circuit composed of the heart and vessels. Its primary job is to deliver oxygen and nutrients while removing waste.",
                    "bullets": ["Pulmonary: To lungs", "Systemic: To body"],
                    "mediaType": "image", 
                    "mediaUrl": "/images/heart/anterior_view.png",
                    "mediaDescription": "Anatomy of the Human Heart"
                }
            },
            {
                "component": "MultipleChoice", 
                "data": {
                    "question": "What is the primary goal of the Pulmonary circulation?", 
                    "options": [
                        {"id": "a", "text": "Deliver nutrients to cells"}, 
                        {"id": "b", "text": "Eliminate CO2 via the lungs"},
                        {"id": "c", "text": "Pump blood to the brain"}
                    ], 
                    "correctOptionId": "b"
                }
            },
            {
                "component": "Ordering", 
                "data": {
                    "question": "Order the sequence of electrical conduction in the heart:", 
                    "steps": [
                        "SA Node (Pacemaker)", 
                        "AV Node", 
                        "Bundle of His",
                        "Purkinje Fibers"
                    ]
                }
            },
            {
                "component": "MatchingPairs", 
                "data": {
                    "question": "Match the heart chambers with their primary roles:",
                    "pairs": [
                        {"id": "p1", "left": "Right Atrium", "right": "Receives deoxygenated blood"}, 
                        {"id": "p2", "left": "Left Atrium", "right": "Receives oxygenated blood"},
                        {"id": "p3", "left": "Right Ventricle", "right": "Pumps blood to lungs"},
                        {"id": "p4", "left": "Left Ventricle", "right": "Pumps blood to rest of body"}
                    ]
                }
            },
            {
                "component": "FeynmanMirror", 
                "data": {
                    "title": "Explain the System",
                    "prompt": "In your own words, explain why the heart is considered a 'double pump'.",
                    "sampleAnswer": "The heart acts as a double pump because the right side pumps blood to the lungs while the left side simultaneously pumps blood to the rest of the body."
                }
            }
        ]
    },
    {"id": "heart-1-2", "title": "Heart Overview", "description": "Size, mass, and location.", "stages": [{"component": "ExplainerMedia", "data": {"title": "Size", "explanation": "Size of a fist."}}]},
    {"id": "heart-1-3", "title": "External Anatomy", "description": "Base, Apex, and surfaces.", "stages": []},
    {"id": "heart-1-4", "title": "Pericardium", "description": "The protective sac.", "stages": []},
    {"id": "heart-1-5", "title": "Heart Wall Layers", "description": "Epicardium, Myocardium, Endocardium.", "stages": []},
    {"id": "heart-1-6", "title": "Right Atrium", "description": "Openings and Fossa Ovalis.", "stages": []},
    {"id": "heart-1-7", "title": "Right Ventricle", "description": "Pumping to lungs.", "stages": []},
    {"id": "heart-1-8", "title": "Left Atrium & Ventricle", "description": "Systemic output.", "stages": []},
    {"id": "heart-1-9", "title": "Heart Valves", "description": "AV and Semilunar valves.", "stages": []},
    {"id": "heart-1-10", "title": "Sulci & Skeleton", "description": "Surface grooves.", "stages": []},
    {"id": "heart-1-11", "title": "Coronary Arteries", "description": "Blood supply to heart.", "stages": []},
    {"id": "heart-1-12", "title": "Coronary Veins", "description": "Venous drainage.", "stages": []},
    {"id": "heart-1-13", "title": "Nerve Supply", "description": "Autonomic control.", "stages": []},
    {"id": "heart-1-14", "title": "Conduction System", "description": "SA, AV, Bundle of His.", "stages": []},
    {"id": "heart-1-15", "title": "Cycle & Sounds", "description": "Systole and Diastole.", "stages": []}
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
        
        # Feynman Grade Logic
        if "isCorrect" in fields:
            return schema.model_validate({"isCorrect": True, "feedback": "Excellent explanation! You accurately described the dual-pump mechanism."})
            
        return schema.model_construct()

    def _mock_questionnaire(self, schema: Type[BaseModel]) -> BaseModel:
        data = {
            "questions": [
                {"id": "q1", "text": "你的專業背景為何？", "type": "choice", "options": ["醫學/生命科學", "資訊/工程", "商業/法律", "人文/社會科學"]},
                {"id": "q2", "text": "你偏好的學習步調？", "type": "choice", "options": ["快速概覽", "穩定進修", "深度研究"]},
                {"id": "q3", "text": "你對此主題的熟悉程度？", "type": "choice", "options": ["完全陌生", "略有耳聞", "具備基礎", "專業人士"]},
                {"id": "q4", "text": "你希望學習內容的難度？", "type": "choice", "options": ["科普入門", "實務應用", "學術深鑽"]}
            ]
        }
        return schema.model_validate(data)

    def _mock_blueprint(self, schema: Type[BaseModel]) -> BaseModel:
        data = {
            "courseTitle": "Cardiovascular System",
            "description": "A comprehensive deep dive into the human heart.",
            "units": [
                {"unit_title": "Foundations", "unit_goal": "Understand basics of heart and circulation."},
                {"unit_title": "Walls", "unit_goal": "Learn about pericardium and heart wall layers."},
                {"unit_title": "Right Heart", "unit_goal": "Explore right atrium and ventricle mechanics."},
                {"unit_title": "Left Heart", "unit_goal": "Analyze left heart chambers and valves."},
                {"unit_title": "Conduction", "unit_goal": "Understand electrical and nerve supply."}
            ]
        }
        return schema.model_validate(data)

    def _mock_unit_expansion(self, schema: Type[BaseModel], msg_text: str) -> BaseModel:
        nodes = []
        if "foundations" in msg_text: nodes = HEART_NODES_DATA[0:3]
        elif "walls" in msg_text: nodes = HEART_NODES_DATA[3:6]
        elif "right" in msg_text: nodes = HEART_NODES_DATA[6:9]
        elif "left" in msg_text: nodes = HEART_NODES_DATA[9:12]
        elif "conduction" in msg_text: nodes = HEART_NODES_DATA[12:15]
        else: nodes = HEART_NODES_DATA[0:3]

        data = {
            "nodes": [
                {"id": n["id"], "title": n["title"], "description": n["description"], "status": "locked", "hasGeneratedLesson": True}
                for n in nodes
            ]
        }
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
        data = {"summary": "專業背景，偏好實務。", "attributes": {"background": "Technical", "pace": "Fast", "focus": "Clinical", "level": "Intermediate"}}
        return schema.model_validate(data)
