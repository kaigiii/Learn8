import re
text_content = """<think>
Wait let me see... {"this is a pseudo thought json"}
</think>
```json
{"stages": [{"stageId": "1", "data": [1,2,3]}]}
```
Some trailing text"""

text_content = re.sub(r'<think>.*?</think>', '', text_content, flags=re.DOTALL)
text_content = re.sub(r'```json\s*', '', text_content)
text_content = re.sub(r'```\s*', '', text_content)

first_brace = min([text_content.find('{') if '{' in text_content else len(text_content), 
                   text_content.find('[') if '[' in text_content else len(text_content)])
last_brace = max(text_content.rfind('}'), text_content.rfind(']'))

if first_brace != len(text_content) and last_brace != -1 and last_brace >= first_brace:
    text_content = text_content[first_brace:last_brace+1]

print("Extracted:")
print(text_content)
