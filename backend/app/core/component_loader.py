import os
import yaml
from pathlib import Path
from typing import Dict, Any, List, Optional

# 定義 game_modules 目錄的絕對或相對路徑
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODULES_DIR = BASE_DIR / "data" / "game_modules"


class ComponentRegistryLoader:
    def __init__(self):
        self.components: Dict[str, Dict[str, Any]] = {}
        self._load_all()

    def _load_all(self):
        """從 modules 目錄中載入所有 YAML 檔案。"""
        from app.core.config import settings

        if not MODULES_DIR.exists():
            print(f"Warning: Modules directory not found at {MODULES_DIR}")
            return

        enabled_modules = [m.strip() for m in settings.ENABLED_GAME_MODULES.split(",") if m.strip()]

        for filename in os.listdir(MODULES_DIR):
            if filename.endswith(".yaml") or filename.endswith(".yml"):
                if enabled_modules and filename not in enabled_modules:
                    continue

                filepath = MODULES_DIR / filename
                with open(filepath, "r", encoding="utf-8") as f:
                    try:
                        data = yaml.safe_load(f)
                        if "name" in data:
                            self.components[data["name"]] = data
                    except yaml.YAMLError as exc:
                        print(f"Error parsing YAML file {filepath}: {exc}")

    def get_component_names(self) -> List[str]:
        """回傳所有已註冊的組件名稱列表。"""
        return list(self.components.keys())

    def get_component(self, name: str) -> Dict[str, Any] | None:
        return self.components.get(name)

    def get_frontend_registry_key(self, name: str) -> str | None:
        component = self.get_component(name)
        if not component:
            return None
        return component.get("frontend_registry_key") or component.get("name")

    def get_required_data_fields(self, name: str) -> List[str]:
        component = self.get_component(name) or {}
        return list(component.get("required_config_data_fields") or [])

    def get_optional_data_fields(self, name: str) -> List[str]:
        component = self.get_component(name) or {}
        return list(component.get("optional_config_data_fields") or [])

    def get_submission_keys(self, name: str) -> List[str]:
        component = self.get_component(name) or {}
        return list(component.get("submission_keys") or [])

    def get_remedial_component_names(self) -> List[str]:
        names: List[str] = []
        for name, data in self.components.items():
            if bool(data.get("allowed_in_remedial", False)):
                names.append(name)
        return names

    def validate_component_data(self, name: str, data: Any) -> List[str]:
        component = self.get_component(name)
        if component is None:
            return [f"Unsupported component: {name}"]

        if not isinstance(data, dict):
            return [f"Component `{name}` requires config.data to be an object."]

        missing_fields = [
            field for field in self.get_required_data_fields(name) if field not in data
        ]
        return [
            f"Component `{name}` is missing required config.data field `{field}`."
            for field in missing_fields
        ]

    def get_prompt_menu_string(self, component_names: Optional[List[str]] = None) -> str:
        """
        根據載入的 YAML 檔案動態生成 'COMPONENT SELECTION MENU' 提示字串，
        並依照模組類別進行分組。
        """
        allowed_names = set(component_names or self.components.keys())
        prompt_parts = []
        
        for name, data in self.components.items():
            if name not in allowed_names:
                continue
            desc = data.get("description", "")
            prompt_parts.append(
                f"- If the goal is to **{desc.lower().replace('if the goal is to ', '')}**: Use `{name}`."
            )

        return "\n".join(prompt_parts)

    def get_prompt_schema_reference_string(
        self, component_names: Optional[List[str]] = None
    ) -> str:
        """
        生成所有組件的 Schema 規則字串，以便後續注入至 LLM 提示詞中。
        """
        prompt_parts = []
        allowed_names = set(component_names or self.components.keys())
        for name, data in self.components.items():
            if name not in allowed_names:
                continue
            reqs = data.get("schema_requirements", "")
            prompt_parts.append(f"Component `{name}`:\n{reqs.strip()}")

        return "\n\n".join(prompt_parts)


# 供整個應用程式使用的 Singleton 實例
registry = ComponentRegistryLoader()
