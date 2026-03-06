from pydantic import BaseModel
from typing import List
import json

class StageListWrapper(BaseModel):
    stages: List[dict]

repaired_json_str = '[{"stageId": "1"}]'
schema = StageListWrapper

try:
    parsed_data = json.loads(repaired_json_str)
    if isinstance(parsed_data, list):
        fields = list(getattr(schema, "model_fields", getattr(schema, "__fields__", {})).keys())
        if len(fields) == 1:
            parsed_data = {fields[0]: parsed_data}
        elif len(fields) > 1 and "stages" in fields:
            parsed_data = {"stages": parsed_data}
            
    print(schema.model_validate(parsed_data))
except Exception as e:
    print("Error:", e)
