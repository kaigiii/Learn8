from typing import Callable, Dict, List, Any

# Validator interface: takes config.data dict and llm_provider, returns list of validation errors
Validator = Callable[[dict, Any], List[str]]

class LessonComponentValidatorRegistry:
    def __init__(self) -> None:
        self._validators: Dict[str, Validator] = {}

    def register(self, component: str, validator: Validator) -> None:
        self._validators[component] = validator

    def get(self, component: str) -> Validator | None:
        return self._validators.get(component)

validator_registry = LessonComponentValidatorRegistry()
