"""§15 — pure-function tests, no network/model calls."""
import pandas as pd

from src.demand_forecasting.forecast_models import forecast_daily_usage, MIN_HISTORY_DAYS_FOR_FORECAST
from src.demand_forecasting.seasonal_analyser import detect_seasonal_uplift, has_sufficient_history, MIN_HISTORY_DAYS_FOR_SEASONALITY


def _series(values: list[float]) -> pd.Series:
    return pd.Series(values, index=pd.date_range("2026-01-01", periods=len(values), freq="D").date)


def test_forecast_returns_none_below_minimum_history():
    short_series = _series([5.0] * (MIN_HISTORY_DAYS_FOR_FORECAST - 1))
    assert forecast_daily_usage(short_series) is None


def test_forecast_returns_none_for_all_zero_history():
    zero_series = _series([0.0] * (MIN_HISTORY_DAYS_FOR_FORECAST + 10))
    assert forecast_daily_usage(zero_series) is None


def test_forecast_returns_a_nonnegative_number_with_enough_history():
    series = _series([4.0, 5.0, 3.0, 6.0, 4.0] * ((MIN_HISTORY_DAYS_FOR_FORECAST // 5) + 2))
    result = forecast_daily_usage(series)
    assert result is not None
    assert result >= 0.0


def test_seasonal_uplift_false_below_minimum_history():
    short_series = _series([5.0] * (MIN_HISTORY_DAYS_FOR_SEASONALITY - 1))
    assert has_sufficient_history(short_series) is False
    assert detect_seasonal_uplift(short_series) is False


def test_seasonal_uplift_detected_with_a_real_spike():
    baseline = [2.0] * (MIN_HISTORY_DAYS_FOR_SEASONALITY - 7)
    spike = [10.0] * 7
    series = _series(baseline + spike)
    assert detect_seasonal_uplift(series) is True


def test_seasonal_uplift_false_when_flat():
    series = _series([3.0] * MIN_HISTORY_DAYS_FOR_SEASONALITY)
    assert detect_seasonal_uplift(series) is False
