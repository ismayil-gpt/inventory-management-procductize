"""Model profiles. Ref: CLAUDE.md §2.1. Switch by LANGUAGE_MODEL_PROFILE."""
from dataclasses import dataclass


@dataclass(frozen=True)
class ModelProfile:
    key: str
    model_tag: str      # the Ollama model tag — the ONLY place a model is named
    arabic_verified: bool


PROFILES: dict[str, ModelProfile] = {
    # Laptop / development — poor Arabic, adequate for building the workflow (§2.2).
    "llama-development": ModelProfile(key="llama-development", model_tag="llama3.2:3b-instruct-q4_K_M", arabic_verified=False),
    # On-premise (Jetson Orin Nano, 8GB unified memory) — production.
    #
    # The spec originally named qwen2.5:14b-instruct-q4_K_M here. Tested directly on this board
    # under real load (backend + frontend + Postgres + Ollama concurrently, not Ollama alone):
    #   - 14B was never viable (not enough unified memory to load it at all).
    #   - 7B was tried previously and confirmed not to work on this board.
    #   - qwen2.5:3b (default quant) loaded and answered correctly in both languages, but left
    #     only ~100-250MB of free system memory with the rest of the stack running, and crashed
    #     once (CUDA OOM) under real startup load before running stable for several more calls.
    #   - Quantizing 3B further did NOT give a safe middle ground: q2_K produced pure gibberish,
    #     and q3_K_M is worse than either — it hallucinated a wrong total in Arabic (said 8 units
    #     when the source data said 12), which is a direct violation of §8.4's "never invent
    #     numbers" rule, not just a quality regression.
    #   - qwen2.5:1.5b had zero crashes across every test (bilingual, concurrent, repeated cold
    #     reloads) with 1.3-2.7GB of headroom, and never invented a number, though its Arabic is
    #     noticeably terser/less fluent than 3B's.
    # Chosen: qwen2.5:1.5b, on reliability — see OPEN-QUESTIONS.md. arabic_verified stays False
    # until the §2.2 gate is actually run against it (documentation/security-compliance/
    # language-model-validation.md) — never assumed true just because it's the "production" slot.
    "qwen-production": ModelProfile(key="qwen-production", model_tag="qwen2.5:1.5b", arabic_verified=False),
}


def resolve_profile(profile_key: str) -> ModelProfile:
    if profile_key not in PROFILES:
        raise ValueError(f"Unknown LANGUAGE_MODEL_PROFILE '{profile_key}'. Known: {list(PROFILES)}")
    return PROFILES[profile_key]
