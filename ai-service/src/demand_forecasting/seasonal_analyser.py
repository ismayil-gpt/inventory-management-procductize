"""Detects a seasonal uplift in demand (§8.2 Stage 2, reasonCode SEASONAL_UPLIFT).
This deployment's movement history is currently ~4 weeks old (see OPEN-QUESTIONS.md) —
nowhere near enough to trust a seasonal signal. This module says so honestly rather
than pretending: it returns "no uplift" until a real minimum of history exists, so
SEASONAL_UPLIFT simply won't fire yet. Pure function — no network, unit-testable.
"""
import pandas as pd

MIN_HISTORY_DAYS_FOR_SEASONALITY = 90
UPLIFT_THRESHOLD = 1.25  # recent week averaging 25%+ above the trailing baseline


def has_sufficient_history(series: pd.Series) -> bool:
    return bool(len(series) >= MIN_HISTORY_DAYS_FOR_SEASONALITY)


def detect_seasonal_uplift(series: pd.Series) -> bool:
    if not has_sufficient_history(series) or series.empty:
        return False
    baseline = series.mean()
    if baseline <= 0:
        return False
    recent = series.tail(7).mean()
    return bool(recent >= baseline * UPLIFT_THRESHOLD)
