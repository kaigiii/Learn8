from .freegemini import FreeGeminiClient
from typing import Any, List, Optional, Dict
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage
from langchain_core.outputs import ChatResult, ChatGeneration

class ChatFreeGemini(BaseChatModel):
    """
    LangChain Adapter for the FreeGemini Local Server.
    Allows using Local Gemini just like 'ChatOpenAI' or 'ChatGoogleGenerativeAI'.
    """
    pid: str
    memory: bool = True
    model: str = "1" # Default to Fast
    project_root: str = "." # Default to CWD, but changeable
    client: Optional[Any] = None # Optional FreeGeminiClient instance

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        # 1. Prepare Content
        # Concatenate all messages to ensure System Prompt is included.
        # This is crucial for ReAct or when specific instructions are passed in SystemMessage.
        full_text = "\n\n".join([m.content for m in messages])
        
        # 2. Call FreeGemini Client SDK
        # We can pass specific files if they are provided in kwargs (e.g. from a previous LangGraph node)
        files = kwargs.get("files", [])
        
        # Determine which client to use: injected instance or convert to default
        c = self.client if self.client else FreeGeminiClient()

        print(f"\n[FreeGemini Local] Processing: {full_text[:50]}...")
        response = c.chat(
            pid=self.pid,
            text=full_text,
            memory=self.memory,
            model=self.model,
            files=files,
            project_root=self.project_root
        )
        
        # 3. Parse Response
        content = response.get("reply", "Error: No reply from FreeGemini Server")
        
        # 4. Return LangChain Result
        msg = AIMessage(content=content)
        generation = ChatGeneration(message=msg)
        return ChatResult(generations=[generation])

    @property
    def _llm_type(self) -> str:
        return "freegemini-local-browser"
