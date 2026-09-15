"""Ollama-backed provider (local, no external calls). Ref: CLAUDE.md §2.1, §4."""
import asyncio

import httpx

from .language_model_provider import LanguageModelProvider, ToolCall, ToolCallResult
from .model_profiles import resolve_profile
from ..shared.configuration import configuration

# Found on the Jetson Orin Nano: the first request after Ollama has unloaded an idle
# model occasionally fails with a CUDA allocator error ("cudaMalloc failed: out of
# memory") even when there's plenty of free system memory — a transient driver/
# runtime quirk, not a real capacity problem. An immediate retry reliably succeeds
# (confirmed repeatedly in testing), so retry once here rather than surfacing a
# degraded answer to every caller for something that isn't a real failure.
_RETRY_DELAY_SECONDS = 1.5


class OllamaProvider(LanguageModelProvider):
    def __init__(self) -> None:
        self._profile = resolve_profile(configuration.language_model_profile)
        self._base = configuration.ollama_url

    async def _chat(self, payload: dict) -> dict:
        last_error: Exception | None = None
        for attempt in range(2):
            if attempt:
                await asyncio.sleep(_RETRY_DELAY_SECONDS)
            try:
                async with httpx.AsyncClient(timeout=120) as client:
                    response = await client.post(f"{self._base}/api/chat", json=payload)
                    response.raise_for_status()
                    return response.json()
            except httpx.HTTPStatusError as error:
                last_error = error
        raise last_error

    async def complete(self, system_prompt: str, user_prompt: str, *, language: str = "en") -> str:
        result = await self._chat({
            "model": self._profile.model_tag,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
        })
        return result["message"]["content"]

    async def complete_with_tools(self, system_prompt: str, user_prompt: str, tools: list[dict], *, language: str = "en") -> ToolCallResult:
        result = await self._chat({
            "model": self._profile.model_tag,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "tools": tools,
            "stream": False,
        })
        message = result["message"]
        raw_calls = message.get("tool_calls") or []
        calls = [ToolCall(name=c["function"]["name"], arguments=c["function"].get("arguments") or {}) for c in raw_calls]
        return ToolCallResult(tool_calls=calls, text=message.get("content") or None)

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                return (await client.get(f"{self._base}/api/tags")).status_code == 200
        except httpx.HTTPError:
            return False
