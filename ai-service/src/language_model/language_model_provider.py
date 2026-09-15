"""Language-model provider interface. Ref: CLAUDE.md §2.1.

All assistant features depend on THIS interface, never on a concrete model. The
model is swapped by a single environment variable (LANGUAGE_MODEL_PROFILE) — no
feature code names a model, ever.

Note (§2.2/§8.3): this affects ONLY the conversational assistant (Stage 2). The
replenishment reasoning is deterministic template text generated in the backend
and is identical on every model.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ToolCall:
    name: str
    arguments: dict


@dataclass(frozen=True)
class ToolCallResult:
    """Either the model called a tool (`tool_calls` non-empty) or it replied
    directly (`text` set) — never both. Only the first tool call is acted on;
    everything here is built around one real query per turn."""
    tool_calls: list[ToolCall] = field(default_factory=list)
    text: str | None = None


class LanguageModelProvider(ABC):
    @abstractmethod
    async def complete(self, system_prompt: str, user_prompt: str, *, language: str = "en") -> str:
        """Return the model's completion for the given prompts."""
        raise NotImplementedError

    @abstractmethod
    async def complete_with_tools(self, system_prompt: str, user_prompt: str, tools: list[dict], *, language: str = "en") -> ToolCallResult:
        """Give the model a menu of real backend queries it can invoke instead of
        answering from memory (§8.4, broadened) — lets the assistant handle
        questions no hand-written keyword rule anticipated (e.g. an arbitrary
        category filter), while every number it eventually states still traces to
        a real tool result, never the model's own memory."""
        raise NotImplementedError

    @abstractmethod
    async def is_available(self) -> bool:
        """Whether the underlying model runtime is reachable."""
        raise NotImplementedError
