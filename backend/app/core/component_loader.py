import os
import yaml
from pathlib import Path
from typing import Dict, Any, List

# 定義 game_modules 目錄的絕對或相對路徑
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODULES_DIR = BASE_DIR / "game_modules"


class ComponentRegistryLoader:
    def __init__(self):
        self.components: Dict[str, Dict[str, Any]] = {}
        self._load_all()

    def _load_all(self):
        """從 modules 目錄中載入所有 YAML 檔案。"""
        if not MODULES_DIR.exists():
            print(f"Warning: Modules directory not found at {MODULES_DIR}")
            return

        for filename in os.listdir(MODULES_DIR):
            if filename.endswith(".yaml") or filename.endswith(".yml"):
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

    def get_prompt_menu_string(self) -> str:
        """
        根據載入的 YAML 檔案動態生成 'COMPONENT SELECTION MENU' 提示字串，
        並依照模組類別進行分組。
        """
        categories = {
            "Instruction": [],
            "Practice": [],
            "Assessment": [],
            "Incentive": [],
        }

        for name, data in self.components.items():
            mod = data.get("module", "Instruction")
            desc = data.get("description", "")
            if mod in categories:
                categories[mod].append(
                    f"- If the goal is to **{desc.lower().replace('if the goal is to ', '')}**: Use `{name}`."
                )

        # 建立最終的提示字串 (Prompt String)
        prompt_parts = []
        for cat, items in categories.items():
            if items:
                prompt_parts.append(f"**{cat}**")
                prompt_parts.extend(items)
                prompt_parts.append("")

        return "\n".join(prompt_parts)

    def get_prompt_schema_reference_string(self) -> str:
        """
        生成所有組件的 Schema 規則字串，以便後續注入至 LLM 提示詞中。
        """
        prompt_parts = []
        for name, data in self.components.items():
            reqs = data.get("schema_requirements", "")
            prompt_parts.append(f"Component `{name}`:\n{reqs.strip()}")

        return "\n\n".join(prompt_parts)


# 供整個應用程式使用的 Singleton 實例
registry = ComponentRegistryLoader()
