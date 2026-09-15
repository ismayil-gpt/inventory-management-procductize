"""Forecasts a product's daily usage from its consumption history (§8.2 Stage 2 —
replaces the backend's 30-day trailing average as the reorder calculator's input,
without changing that calculator's interface). Returns None to signal "not enough
history — fall back to the plain trailing average", never a guess.
"""
import pandas as pd

MIN_HISTORY_DAYS_FOR_FORECAST = 30


def forecast_daily_usage(series: pd.Series) -> float | None:
    if len(series) < MIN_HISTORY_DAYS_FOR_FORECAST or series.sum() <= 0:
        return None

    import statsmodels.api as sm  # local import — only the daily batch job pays this cost

    try:
        fitted = sm.tsa.SimpleExpSmoothing(series, initialization_method="estimated").fit()
        forecast = float(fitted.forecast(1).iloc[0])
    except Exception:
        return None

    return max(0.0, forecast)
