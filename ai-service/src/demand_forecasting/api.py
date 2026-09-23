"""GET /forecasting/products/{product_id} — internal only, called by the backend's
ai-service-client for the Predictive Analytics Dashboard's Forecast vs Actual panel
(CLAUDE.md §8.2 Stage 2). Uses the SAME forecasting code the daily job uses
(`forecast_models`, `consumption_history`) — never a re-implementation, never a
fabricated line (§8.3, §18). Below the model's real history minimum, `hasForecast`
is false and `forecast` is empty; the caller is expected to show that honestly
rather than draw anything.
"""
from datetime import date, timedelta

from fastapi import APIRouter
from pydantic import BaseModel

from ..assistant.inventory_data_retriever import InventoryDataRetriever
from .consumption_history import fetch_daily_consumption
from .forecast_models import MIN_HISTORY_DAYS_FOR_FORECAST, forecast_daily_usage
from .seasonal_analyser import MIN_HISTORY_DAYS_FOR_SEASONALITY, detect_seasonal_uplift, has_sufficient_history

router = APIRouter(prefix="/forecasting", tags=["forecasting"])

_retriever = InventoryDataRetriever()

# The model itself is fit on up to 120 days of real history; the chart only shows
# the most recent 60 for legibility (120 daily points is too dense to read).
FORECAST_DAYS_AHEAD = 14
DISPLAY_HISTORY_DAYS = 60


class HistoryPoint(BaseModel):
    date: str
    actual: float


class ForecastPoint(BaseModel):
    date: str
    value: float


class ForecastResponse(BaseModel):
    productId: str
    historyDays: int
    minHistoryForForecast: int
    minHistoryForSeasonality: int
    hasForecast: bool
    hasSufficientHistoryForSeasonality: bool
    hasSeasonalSignal: bool
    dailyUsageForecast: float | None
    history: list[HistoryPoint]
    forecast: list[ForecastPoint]


def _empty_response(product_id: str) -> ForecastResponse:
    return ForecastResponse(
        productId=product_id,
        historyDays=0,
        minHistoryForForecast=MIN_HISTORY_DAYS_FOR_FORECAST,
        minHistoryForSeasonality=MIN_HISTORY_DAYS_FOR_SEASONALITY,
        hasForecast=False,
        hasSufficientHistoryForSeasonality=False,
        hasSeasonalSignal=False,
        dailyUsageForecast=None,
        history=[],
        forecast=[],
    )


@router.get("/products/{product_id}", response_model=ForecastResponse)
async def get_forecast(product_id: str) -> ForecastResponse:
    series = await fetch_daily_consumption(_retriever, product_id, days=120)
    if series.empty:
        return _empty_response(product_id)

    forecast_value = forecast_daily_usage(series)
    seasonal_signal = detect_seasonal_uplift(series)
    sufficient_for_seasonality = has_sufficient_history(series)

    display_series = series.tail(DISPLAY_HISTORY_DAYS)
    history = [HistoryPoint(date=d.isoformat(), actual=float(v)) for d, v in display_series.items()]

    forecast_points: list[ForecastPoint] = []
    if forecast_value is not None:
        last_date: date = series.index.max()
        rounded = round(forecast_value, 2)
        forecast_points = [
            ForecastPoint(date=(last_date + timedelta(days=i)).isoformat(), value=rounded)
            for i in range(1, FORECAST_DAYS_AHEAD + 1)
        ]

    return ForecastResponse(
        productId=product_id,
        historyDays=len(series),
        minHistoryForForecast=MIN_HISTORY_DAYS_FOR_FORECAST,
        minHistoryForSeasonality=MIN_HISTORY_DAYS_FOR_SEASONALITY,
        hasForecast=forecast_value is not None,
        hasSufficientHistoryForSeasonality=sufficient_for_seasonality,
        hasSeasonalSignal=seasonal_signal,
        dailyUsageForecast=round(forecast_value, 2) if forecast_value is not None else None,
        history=history,
        forecast=forecast_points,
    )
