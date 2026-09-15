"""Scheduled daily reorder review. Ref: CLAUDE.md §8.1.

The reorder *logic* is deterministic and lives in the backend (`replenishment`
module) so it is transparent and reproducible (§8.2/§8.3). This job triggers that
review on a schedule. Stage 2 (§8.2, §13.5) adds one step first: compute a demand
forecast per active product from real consumption history, and pass it along as an
optional override — the backend falls back to its plain 30-day average for any
product with no forecast (too little history, or a forecasting error). No AI/LLM
scores the reorder decision itself either way (§8.3) — only `dailyUsage` changes.
"""
import logging

import httpx

from ..assistant.inventory_data_retriever import InventoryDataRetriever
from ..demand_forecasting.consumption_history import fetch_daily_consumption
from ..demand_forecasting.forecast_models import forecast_daily_usage
from ..demand_forecasting.seasonal_analyser import detect_seasonal_uplift
from ..shared.configuration import configuration

logger = logging.getLogger("daily_review_job")


async def _build_forecasts(retriever: InventoryDataRetriever) -> dict[str, dict]:
    forecasts: dict[str, dict] = {}
    try:
        products = await retriever.product_catalogue()
    except Exception:
        logger.warning("Forecast step skipped — could not fetch the product catalogue.")
        return forecasts

    for product in products:
        try:
            series = await fetch_daily_consumption(retriever, product.id)
            usage = forecast_daily_usage(series)
            if usage is None:
                continue  # not enough history — backend uses its own trailing average
            reason_code = "SEASONAL_UPLIFT" if detect_seasonal_uplift(series) else "FORECAST_DEPLETION"
            forecasts[product.id] = {"dailyUsage": usage, "reasonCode": reason_code}
        except Exception:
            logger.warning("Forecast failed for product %s — falling back to the trailing average.", product.id, exc_info=True)
            continue

    return forecasts


async def run_daily_review() -> None:
    base = configuration.backend_base_url
    retriever = InventoryDataRetriever()
    forecasts = await _build_forecasts(retriever)
    logger.info("Computed %s Stage-2 forecast override(s).", len(forecasts))

    async with httpx.AsyncClient(timeout=60) as client:
        # Authenticate the service account.
        login = await client.post(
            f"{base}/auth/login",
            json={
                "email": configuration.service_account_email,
                "password": configuration.service_account_password,
            },
        )
        if login.status_code != 200:
            logger.error("Daily review skipped — service account login failed (%s).", login.status_code)
            return
        token = login.json()["accessToken"]

        # Trigger the deterministic review in the backend.
        result = await client.post(
            f"{base}/recommendations/run",
            headers={"Authorization": f"Bearer {token}"},
            json={"forecasts": forecasts} if forecasts else {},
        )
        if result.status_code in (200, 201):
            generated = result.json().get("generated", 0)
            logger.info("Daily review complete — %s recommendation(s) generated.", generated)
        else:
            logger.error("Daily review failed (%s): %s", result.status_code, result.text)
