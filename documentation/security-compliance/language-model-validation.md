# Language Model Validation — §2.2 Arabic Quality Gate

> Ref: `CLAUDE.md` §2.2. "Do not present the assistant to the client on the development
> model" — before UAT, the full assistant pipeline must be re-run against the production
> model and Arabic quality manually reviewed, with the result recorded here honestly.

## Hardware and model context

The production device is a **Jetson Orin Nano, 8GB unified memory** (JetPack 6.2.1, Ollama
running natively). The spec originally named `qwen2.5:14b-instruct-q4_K_M` for
`qwen-production`. Direct testing on this board (2026-09-02, backend + frontend + Postgres +
Ollama all running concurrently — the real usage condition) found:

- 14B never fit in memory.
- 7B was tried previously (by the user) and confirmed not to work.
- Default-quant `qwen2.5:3b` loaded and answered correctly, but left only ~100–250MB of free
  system memory with the rest of the stack running, and crashed once (CUDA OOM) under real
  startup load before running stable across several subsequent calls.
- Quantizing 3B further made things *worse*, not better: `q2_K` produced pure gibberish
  output; `q3_K_M` hallucinated a wrong total in Arabic (stated 8 units when the source data
  said 12) — a direct violation of §8.4's "never invent numbers" rule.
- `qwen2.5:1.5b` had 1.3–2.7GB of memory headroom, well ahead of 3B.

**Decision**: `qwen-production` targets `qwen2.5:1.5b` (`ai-service/src/language_model/
model_profiles.py`), chosen for reliability. Full reasoning and the fallback ladder are
recorded in `OPEN-QUESTIONS.md` #8.

**Update, same day — a board-level flake, not a model-size problem.** `qwen2.5:1.5b` later hit
the identical `cudaMalloc failed: out of memory` error once, on a cold model load right after
Ollama's idle-unload — with over 1GB of free system RAM at the time. This means the crash isn't
really about model size or memory pressure at all; it's a Jetson CUDA-allocator quirk on cold
load that a smaller model doesn't eliminate. An immediate retry succeeded every time it was
tried. `OllamaProvider.complete()` (`ai-service/src/language_model/ollama_provider.py`) now
retries once automatically before propagating a failure, so this transient condition resolves
itself rather than surfacing a degraded (fallback-message) answer to the user.

## What this gate does NOT cover

The deterministic replenishment reasoning (§8.3 — reorder recommendations, the numbers a
Purchase Order is built from) is **template text filled with computed values, never
LLM-generated**, and is identical on every model. This gate concerns only the **conversational
assistant** (§8.4), which is genuinely LLM-phrased.

## Test method

Real end-to-end queries against the live stack on this Jetson: frontend → backend
(`POST /assistant/query`, audited) → ai-service (intent routing → real backend data
retrieval → `qwen2.5:1.5b` via Ollama) → composed answer, checked against the actual
database values. Both English and Arabic, across all five intents (stock level, low-stock
list, pending recommendations, recent movements, general summary), plus an off-topic query
to confirm graceful refusal.

## Result: **does not pass** — Arabic ships with the development-model badge

English quality is solid: natural phrasing, numbers consistently correct and traceable to
real data (verified by `response_composer.py`'s self-check, which independently confirms
every number the model states — see "Safety net" below).

Arabic quality has real, repeatable problems, consistent with `qwen2.5:1.5b` being in the
same size class as the laptop's `llama-development` model (§2.2's original caveat, generalised
here to the production board's actual capability, not the 14B originally assumed):

- **Wrong language entirely, once observed**: asked "كم لدينا من السكر؟" (how much sugar do we
  have?), the model answered fluently *in English* — all the numbers were correct, so a
  numbers-only check would have let it through undetected. (This finding drove a real code fix
  — see below.)
- **Grammatical awkwardness / unnatural phrasing**: e.g. "المنتج ... يحتوي على 17 كمية في
  المخزون" (lit. "the product ... contains 17 quantity in stock") — correct numbers, unnatural
  Arabic.
- **Invented (non-numeric) descriptors**: e.g. stating a quantity in "كيلوغرام" (kilograms) when
  the source data carries no unit at all — not a wrong *number*, but an added claim not present
  in the retrieved data.
- **Occasional omission of supplied detail**: a location/designator present in the source data
  sometimes dropped from the composed Arabic sentence, even when the sentence was otherwise
  accurate.
- **Mistranscribed product names**: one response rendered a real Arabic product name that
  didn't cleanly match the catalogue's actual `nameAr` string.

None of these were number-fabrication in the strict §8.4 sense (a wrong figure stated as fact)
after the safety net below was added — but several are real quality/fidelity defects a human
reviewer should not wave through as "production-ready Arabic."

## Safety net (built in response to this testing, not after the fact)

Given a small model can be prompt-fragile and occasionally wrong in ways plain instruction-
following doesn't prevent, `response_composer.py` **verifies its own output before returning
it**, rather than trusting the model:

1. **Every number** in the data given to the model must appear in its composed answer, or the
   composition is discarded.
2. **The answer must be in the requested language** (script-majority check) — added directly
   because of the English-instead-of-Arabic finding above.
3. If either check fails, the response falls back to a **plain deterministic sentence** built
   from the same data (no LLM) — the same "deterministic over generative" principle §8.3
   already applies to reasoning text, extended here to the assistant's phrasing step.

This means a bad composition never silently reaches the user with wrong or missing facts — but
it does not by itself make weak Arabic *fluency* pass a quality bar; it only guarantees
**factual correctness or a safe fallback**, which is a different, narrower claim on the numbers
than on natural to guarantee.

## Consequence for this deployment

- `model_profiles.py`: `qwen-production`'s `arabic_verified = False`. This is not a placeholder
  — it reflects the actual result above.
- The backend's `/assistant/query` response carries `isDevelopmentModel: true` whenever
  `arabic_verified` is false for the active profile **and** the requested language is Arabic —
  verified live: an Arabic query against `qwen-production` on this board returns
  `isDevelopmentModel: true`, exactly as intended.
- The frontend shows the existing `app.developmentModelBadge` string next to any assistant
  answer carrying that flag (`AssistantPanel.tsx`).
- **Per §2.2's own rule, generalised**: do not present the Arabic assistant to the client as
  finished work. English is solid. Arabic needs either a better-fitting model (more memory
  headroom on a future hardware revision, or a more capable small model as the local-LLM
  landscape improves) or dedicated prompt/fine-tuning work before this gate can honestly be
  marked passed.

## Update — tool-calling added, a further Arabic gap found and mitigated

A live user report ("should I reorder Bottled Water 1.5L (6s)?" got a flat refusal) exposed the
real limitation of the original design: a fixed menu of ~7 hand-written keyword intents has no
path to real data for anything outside that menu — e.g. a category filter ("dairy and creamers
products that are low"), no matter how the question is phrased.

**Fix**: `qwen2.5:1.5b` was tested and confirmed capable of Ollama tool-calling (`api/chat`'s
`tools` parameter) — with an explicit system-prompt instruction to always call a tool, it
reliably picks a sensible tool and extracts sensible arguments (e.g. `{"category": "dairy",
"low_stock_only": true}`) from free-form English. Six tools now cover the same real backend
queries the keyword router already used, plus a `search_products` tool that supports category
filtering — the actual gap. Priority order, in production: the keyword router runs first (it's
precise and well-tested for phrasing it recognises — confirmed via a regression where
tool-calling, if tried first, sometimes picked a less-useful tool for a case the keyword router
already handled exactly right); tool-calling only runs when the keyword router's fixed menu
doesn't match anything, extending real coverage rather than replacing what already worked.

**A further Arabic-specific correctness gap, found testing this addition**: with the identical
guardrailed prompt, English handled an unresolved general-chat case correctly (answered a
genuine general-knowledge question correctly, no fabrication). Arabic did not — it invented
plausible-sounding but entirely fake product sub-category names ("fresh dairy," "early creamer
products") that don't exist anywhere in the catalogue, with **no number in the answer** for the
existing numeric verification to catch. This is a step beyond the earlier-documented
grammatical/fluency weaknesses: it's outright fabrication of inventory-sounding content, in a
tier explicit prompting couldn't prevent even after a retry.

**Mitigation**: `response_composer.compose_general()` now skips free-generation entirely for
Arabic and returns a fixed, safe message — deterministic, not LLM output, by design (§18's
"deterministic over generative," applied here because the model demonstrably can't be trusted at
this specific task in this language). This is a real UX cost (genuine Arabic small talk gets the
same "I couldn't find a match" message as an unresolved inventory question), accepted
deliberately over the alternative. Covered by `tests/test_response_composer.py`
(`test_compose_general_arabic_never_calls_the_model`), which asserts this is structural, not an
accident of the current prompt.

**Net effect on this gate's status**: unchanged — still does not pass for Arabic. If anything,
this update sharpens *why*: it's not only fluency, but the model's Arabic instruction-following
being unreliable enough that a real fabrication risk existed and needed a structural (not
prompt-only) fix.

## Re-running this gate

1. Ensure `ai-service/.env.development` (or the production `.env`) has
   `LANGUAGE_MODEL_PROFILE=qwen-production`.
2. Run the ai-service (`uvicorn src.main:app`) alongside the backend and Postgres — test under
   real concurrent load, not Ollama in isolation; several of the findings above only appeared
   under load.
3. Exercise all five intents in both languages via `POST /assistant/query`, cross-checking
   every stated number against the database directly (e.g. `psql`).
4. Manually read every Arabic response for fluency, not just factual correctness — the
   verification net catches wrong/missing numbers and wrong language, not awkward phrasing.
5. Update this file with the dated result. Do not mark the gate passed based on the safety net
   alone — it is a floor, not a fluency bar.
