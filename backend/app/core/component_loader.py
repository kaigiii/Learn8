"""
Module: app.core.component_loader
Description: Dynamically loads game module configurations from YAML files.
This replaces hardcoded Pydantic schemas and prompts, allowing users to
add new game components simply by dropping a new YAML file.
"""
import os
import yaml
from pathlib import Path
from typing import Dict, Any, List

# Define the absolute or relative path to the game_modules directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODULES_DIR = BASE_DIR / "game_modules"

class ComponentRegistryLoader:
    def __init__(self):
        self.components: Dict[str, Dict[str, Any]] = {}
        self._load_all()

    def _load_all(self):
        """Loads all YAML files from the modules directory."""
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
        """Returns a list of all registered component names."""
        return list(self.components.keys())

    def get_prompt_menu_string(self) -> str:
        """
        Generates the 'COMPONENT SELECTION MENU' prompt string dynamically
        based on the loaded YAML files. Groups them by module category.
        """
        categories = {
            "Instruction": [],
            "Practice": [],
            "Assessment": [],
            "Incentive": []
        }
        
        for name, data in self.components.items():
            mod = data.get("module", "Instruction")
            desc = data.get("description", "")
            if mod in categories:
                categories[mod].append(f"- If the goal is to **{desc.lower().replace('if the goal is to ', '')}**: Use `{name}`.")
        
        # Build the final prompt string
        prompt_parts = []
        for cat, items in categories.items():
            if items:
                prompt_parts.append(f"**{cat}**")
                prompt_parts.extend(items)
                prompt_parts.append("")
                
        return "\n".join(prompt_parts)

    def get_prompt_schema_reference_string(self) -> str:
        """
        Generates the schema requirements string for all components
        to be injected into the LLM prompt.
        """
        prompt_parts = []
        for name, data in self.components.items():
            reqs = data.get("schema_requirements", "")
            prompt_parts.append(f"Component `{name}`:\n{reqs.strip()}")
            
        return "\n\n".join(prompt_parts)

# Singleton instance for the app to use
registry = ComponentRegistryLoader()
