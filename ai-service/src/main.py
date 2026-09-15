"""Mizan AI service (FastAPI). Ref: CLAUDE.md §3.3, §8.

Present responsibilities:
  * health check (used by the compose healthcheck)
  * schedule the daily reorder review (which the backend computes deterministically)

Stage 2 grows this service with demand forecasting and the bilingual assistant,
via the language-model provider abstraction in `language_model/` (§2.1).
"""
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI

from .replenishment.daily_review_job import run_daily_review
from .shared.configuration import configuration
from .assistant.api import router as assistant_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

scheduler = AsyncIOScheduler(timezone=configuration.timezone)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    hour, minute = (int(p) for p in configuration.replenishment_run_time.split(":"))
    scheduler.add_job(run_daily_review, CronTrigger(hour=hour, minute=minute), id="daily_review", replace_existing=True)
    scheduler.start()
    logger.info("Scheduled daily review at %s %s (profile: %s).", configuration.replenishment_run_time, configuration.timezone, configuration.language_model_profile)
    yield
    scheduler.shutdown()


app = FastAPI(title="Mizan AI Service", version="0.1.0", lifespan=lifespan)
app.include_router(assistant_router)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "mizan-ai-service",
        "languageModelProfile": configuration.language_model_profile,
        "dailyReviewAt": configuration.replenishment_run_time,
    }
