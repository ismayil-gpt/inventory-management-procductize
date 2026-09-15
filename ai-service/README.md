# Mizan AI Service

FastAPI service. Ref: `CLAUDE.md` §2, §3.3, §8.

## What lives where (important)

The **deterministic reorder engine** (§8.2) and the **bilingual reasoning
templates** (§8.3) live in the **backend** (`backend/src/modules/replenishment`),
alongside recommendations, purchase orders and SMTP. That maths is transparent,
reproducible, auditable, and identical in any language — so it belongs with the
system of record, and it runs and is verified without a GPU or Ollama.

This **AI service** is responsible for the parts that are genuinely "AI" or need
to run on a schedule:

- **Now:** trigger the daily reorder **review** on a cron schedule
  (`src/replenishment/daily_review_job.py` → backend `POST /recommendations/run`).
- **Health:** `GET /health`.
- **Stage 2 (on the GPU device):** demand forecasting, and the bilingual
  conversational **assistant** via the language-model provider abstraction
  (`src/language_model/`). The model is chosen by one env var —
  `LANGUAGE_MODEL_PROFILE` (`llama-development` ↔ `qwen-production`, §2.1). No
  feature code names a model.

> This split is recorded in `OPEN-QUESTIONS.md`. It keeps the deterministic
> procurement logic verifiable today while preserving the spec's architecture for
> the AI features that arrive with the production device.

## Run (once dependencies are installed)

```bash
cd ai-service
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
uvicorn src.main:app --port 8000
```

Set `SERVICE_ACCOUNT_PASSWORD` (and `BACKEND_BASE_URL`) in the environment for the
scheduled review to authenticate. On the laptop the deterministic review can also
be triggered manually from the app (**Replenishment → Run review now**) or via
`POST /api/v1/recommendations/run`, so running this service locally is optional.
