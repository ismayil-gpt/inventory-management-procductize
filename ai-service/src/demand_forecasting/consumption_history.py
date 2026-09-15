"""Pulls a product's full trailing GOODS_OUT history and turns it into a daily,
zero-filled series. Ref: CLAUDE.md §8.2 (Stage 2). No AI here — this is data
plumbing only; `forecast_models.py` does the actual forecasting.
"""
from datetime import datetime, timedelta, timezone

import pandas as pd

from ..assistant.inventory_data_retriever import InventoryDataRetriever


async def fetch_daily_consumption(retriever: InventoryDataRetriever, product_id: str, days: int = 180) -> pd.Series:
    """Daily total GOODS_OUT quantity for the trailing `days`, indexed by date,
    zero-filled for days with no movement. Empty series when there's no history."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    movements = await retriever.movements_since(product_id, movement_type="GOODS_OUT", since_iso_date=since)
    if not movements:
        return pd.Series(dtype=float)

    frame = pd.DataFrame(movements)
    frame["date"] = pd.to_datetime(frame["createdAt"]).dt.date
    daily = frame.groupby("date")["quantity"].sum()

    full_index = pd.date_range(start=daily.index.min(), end=daily.index.max(), freq="D").date
    return daily.reindex(full_index, fill_value=0).astype(float)
