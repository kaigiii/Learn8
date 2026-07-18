import pytest
from app.core.component_loader import registry

def test_b2b_modules_loaded():
    """驗證新組件已被註冊加載"""
    names = registry.get_component_names()
    assert "DynamicCategorySorter" in names
    assert "GanttLogicScheduler" in names
    assert "DocumentAnomalyDebugger" in names

def test_dynamic_category_sorter_validation():
    """測試 DynamicCategorySorter 的 Schema 驗證"""
    name = "DynamicCategorySorter"
    
    # 1. 成功案例 (包含所有必要欄位)
    valid_data = {
        "title": "PDCA 分類挑戰",
        "categories": [
            {"id": "P", "label": "計畫"}
        ],
        "cards": [
            {"id": "c1", "text": "制定甘特圖", "correctCategoryId": "P"}
        ]
    }
    errors = registry.validate_component_data(name, valid_data)
    assert len(errors) == 0

    # 2. 失敗案例 (缺少必要欄位)
    invalid_data = {
        "title": "PDCA 分類挑戰"
        # 缺少 categories 和 cards
    }
    errors = registry.validate_component_data(name, invalid_data)
    assert len(errors) > 0
    assert any("categories" in err for err in errors)
    assert any("cards" in err for err in errors)

def test_gantt_logic_scheduler_validation():
    """測試 GanttLogicScheduler 的 Schema 驗證"""
    name = "GanttLogicScheduler"

    # 1. 成功案例
    valid_data = {
        "title": "甘特圖排程規劃",
        "tasks": [
            {"id": "t1", "label": "需求分析", "defaultDuration": 3}
        ],
        "timeLimit": 10
    }
    errors = registry.validate_component_data(name, valid_data)
    assert len(errors) == 0

    # 2. 失敗案例 (缺少 timeLimit)
    invalid_data = {
        "title": "甘特圖排程規劃",
        "tasks": []
    }
    errors = registry.validate_component_data(name, invalid_data)
    assert len(errors) > 0
    assert any("timeLimit" in err for err in errors)

def test_document_anomaly_debugger_validation():
    """測試 DocumentAnomalyDebugger 的 Schema 驗證"""
    name = "DocumentAnomalyDebugger"

    # 1. 成功案例
    valid_data = {
        "title": "工時報表稽核",
        "documentHtml": "<table><tr><td data-anomaly-id='a1'>12小時</td></tr></table>",
        "anomalies": [
            {"anomalyId": "a1", "reason": "工時登載異常", "points": 10}
        ]
    }
    errors = registry.validate_component_data(name, valid_data)
    assert len(errors) == 0

    # 2. 失敗案例 (缺少 documentHtml)
    invalid_data = {
        "title": "工時報表稽核",
        "anomalies": []
    }
    errors = registry.validate_component_data(name, invalid_data)
    assert len(errors) > 0
    assert any("documentHtml" in err for err in errors)

def test_prompt_reference_inclusion():
    """驗證新組件的描述和 Schema 是否能順利被 AI 提示字串讀取與渲染"""
    menu_string = registry.get_prompt_menu_string()
    schema_string = registry.get_prompt_schema_reference_string()

    # 驗證 Menu 中包含組件說明
    assert "DynamicCategorySorter" in menu_string
    assert "GanttLogicScheduler" in menu_string
    assert "DocumentAnomalyDebugger" in menu_string

    # 驗證 Schema 參考中包含對應的 Schema 需求
    assert "Component `DynamicCategorySorter`" in schema_string
    assert "Component `GanttLogicScheduler`" in schema_string
    assert "Component `DocumentAnomalyDebugger`" in schema_string


@pytest.mark.anyio
async def test_dynamic_category_sorter_evaluation():
    """測試 DynamicCategorySorter 的答案評估器"""
    from app.schemas.lesson_schema import LessonStage, GenericConfig, Validation, Feedback
    from app.services.domain.learning.lesson_components.evaluators import evaluate_dynamic_category_sorter

    stage = LessonStage(
        stageId="test-sorter",
        topic="分類",
        skin="Classic",
        component="DynamicCategorySorter",
        validation=Validation(type="logic", condition={}),
        feedback=Feedback(success="全對！", error="有錯。"),
        config=GenericConfig(
            data={
                "title": "分類標題",
                "categories": [{"id": "P", "label": "計畫"}],
                "cards": [{"id": "c1", "text": "制定甘特圖", "correctCategoryId": "P"}]
            },
            initialState={}
        )
    )

    # 1. 成功案例
    res_type, msg, norm_in, eval_out = await evaluate_dynamic_category_sorter(
        stage, {"completed": True, "errorCount": 0, "wrongMatches": []}, "Topic", None
    )
    assert res_type == "correct"
    assert msg == "全對！"
    assert eval_out["errorCount"] == 0

    # 2. 失敗案例
    res_type, msg, norm_in, eval_out = await evaluate_dynamic_category_sorter(
        stage, {"completed": True, "errorCount": 2, "wrongMatches": ["item1"]}, "Topic", None
    )
    assert res_type == "incorrect"
    assert msg == "有錯。"
    assert eval_out["errorCount"] == 2


@pytest.mark.anyio
async def test_gantt_logic_scheduler_evaluation():
    """測試 GanttLogicScheduler 的答案評估器"""
    from app.schemas.lesson_schema import LessonStage, GenericConfig, Validation, Feedback
    from app.services.domain.learning.lesson_components.evaluators import evaluate_gantt_logic_scheduler

    stage = LessonStage(
        stageId="test-gantt",
        topic="排程",
        skin="Classic",
        component="GanttLogicScheduler",
        validation=Validation(type="logic", condition={}),
        feedback=Feedback(success="排程合理！", error="邏輯衝突。"),
        config=GenericConfig(
            data={
                "title": "排程標題",
                "tasks": [{"id": "t1", "label": "需求分析", "defaultDuration": 3}],
                "timeLimit": 10
            },
            initialState={}
        )
    )

    # 1. 成功案例
    res_type, msg, norm_in, eval_out = await evaluate_gantt_logic_scheduler(
        stage, {"completed": True, "logicErrors": [], "durationUsed": 5}, "Topic", None
    )
    assert res_type == "correct"
    assert msg == "排程合理！"
    assert eval_out["durationUsed"] == 5

    # 2. 失敗案例
    res_type, msg, norm_in, eval_out = await evaluate_gantt_logic_scheduler(
        stage, {"completed": True, "logicErrors": ["錯誤時間相依"], "durationUsed": 6}, "Topic", None
    )
    assert res_type == "incorrect"
    assert msg == "邏輯衝突。"
    assert "錯誤時間相依" in eval_out["logicErrors"]


@pytest.mark.anyio
async def test_document_anomaly_debugger_evaluation():
    """測試 DocumentAnomalyDebugger 的答案評估器"""
    from app.schemas.lesson_schema import LessonStage, GenericConfig, Validation, Feedback
    from app.services.domain.learning.lesson_components.evaluators import evaluate_document_anomaly_debugger

    stage = LessonStage(
        stageId="test-debugger",
        topic="除錯",
        skin="Classic",
        component="DocumentAnomalyDebugger",
        validation=Validation(type="logic", condition={}),
        feedback=Feedback(success="稽核完成！", error="遺漏異常。"),
        config=GenericConfig(
            data={
                "title": "除錯標題",
                "documentHtml": "<div></div>",
                "anomalies": [
                    {"anomalyId": "a1", "reason": "R1", "points": 5},
                    {"anomalyId": "a2", "reason": "R2", "points": 5}
                ]
            },
            initialState={}
        )
    )

    # 1. 成功案例
    res_type, msg, norm_in, eval_out = await evaluate_document_anomaly_debugger(
        stage, {"completed": True, "foundCount": 2, "wrongClicks": 0}, "Topic", None
    )
    assert res_type == "correct"
    assert msg == "稽核完成！"
    assert eval_out["foundCount"] == 2
    assert eval_out["totalAnomalies"] == 2

    # 2. 失敗案例
    res_type, msg, norm_in, eval_out = await evaluate_document_anomaly_debugger(
        stage, {"completed": True, "foundCount": 1, "wrongClicks": 1}, "Topic", None
    )
    assert res_type == "incorrect"
    assert msg == "遺漏異常。"
    assert eval_out["foundCount"] == 1
    assert eval_out["totalAnomalies"] == 2

