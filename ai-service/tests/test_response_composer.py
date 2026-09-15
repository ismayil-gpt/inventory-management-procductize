"""§15 — pure-function tests for the composer's self-verification (no network/model
calls; `compose()` itself needs a live provider and is exercised by hand against the
real stack, see documentation/security-compliance/language-model-validation.md)."""
import pytest

from src.assistant.response_composer import _GENERAL_FALLBACK, _is_in_requested_language, _verify, compose_general


def test_english_answer_passes_for_english_request():
    assert _is_in_requested_language("There are 32 units in stock.", "en") is True


def test_arabic_answer_passes_for_arabic_request():
    assert _is_in_requested_language("يوجد 32 وحدة في المخزون.", "ar") is True


def test_english_answer_fails_for_arabic_request():
    # Regression: found on this hardware — asked for Arabic, qwen2.5:1.5b answered
    # fluently in English. All the numbers were correct, so naive numeric
    # verification alone would have let it through.
    assert _is_in_requested_language("The SKU PRD-0011 has a total stock of 65 units.", "ar") is False


def test_arabic_answer_fails_for_english_request():
    assert _is_in_requested_language("يوجد 32 وحدة في المخزون.", "en") is False


def test_designator_only_answer_does_not_falsely_fail_arabic_check():
    # Designators/SKUs stay Latin by design even in Arabic answers (§10) — the
    # language check must tolerate that, not just require zero Latin characters.
    assert _is_in_requested_language("يوجد 12 وحدة في الموقع SR1-R1-L1.", "ar") is True


def test_verify_rejects_wrong_language_even_with_correct_numbers():
    assert _verify("The SKU PRD-0011 has a total stock of 65 units.", ["65"], "ar") is False


def test_verify_accepts_correct_language_and_numbers():
    assert _verify("يوجد 65 وحدة في المخزون.", ["65"], "ar") is True


def test_verify_rejects_missing_number_even_in_correct_language():
    assert _verify("يوجد بعض الوحدات في المخزون.", ["65"], "ar") is False


class _ProviderThatWouldFabricate:
    """Stands in for a real LanguageModelProvider — if `compose_general` ever
    calls it for Arabic, the test fails immediately, proving the short-circuit
    is structural, not just a passing empirical observation."""
    async def complete(self, system_prompt, user_prompt, *, language="en"):
        raise AssertionError("compose_general must not call the provider for Arabic")

    async def complete_with_tools(self, system_prompt, user_prompt, tools, *, language="en"):
        raise AssertionError("not used by compose_general")

    async def is_available(self):
        return True


@pytest.mark.asyncio
async def test_compose_general_arabic_never_calls_the_model():
    # Regression: found live — even with a strict guardrail prompt, qwen2.5:1.5b
    # fabricated fake sub-category names in Arabic here (no real number to catch
    # via _verify). English handled the identical scenario correctly. Arabic in
    # this tier is now fully deterministic — see response_composer.py for the
    # full reasoning.
    result = await compose_general("سؤال عشوائي", "ar", _ProviderThatWouldFabricate())
    assert result.answer == _GENERAL_FALLBACK["ar"]


@pytest.mark.asyncio
async def test_compose_general_english_still_uses_the_model():
    class StubProvider:
        async def complete(self, system_prompt, user_prompt, *, language="en"):
            return "Paris is the capital of France."

        async def is_available(self):
            return True

    result = await compose_general("What is the capital of France?", "en", StubProvider())
    assert result.answer == "Paris is the capital of France."
