"""Fetches real inventory data from the backend for the assistant to phrase (§8.4).
The model never sees anything the backend didn't return — every figure the assistant
states traces back to a call made here. Reuses the same service-account login pattern
as `replenishment/daily_review_job.py`.
"""
import time

import httpx

from .query_router import CategoryRef, ProductRef
from ..shared.configuration import configuration

_TOKEN_SAFETY_MARGIN_SECONDS = 60  # refresh a little before the 15-minute access token expires
_ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60
_CATALOGUE_TTL_SECONDS = 5 * 60  # product/category lists change rarely; avoid refetching every query


class InventoryDataRetriever:
    def __init__(self) -> None:
        self._base = configuration.backend_base_url
        self._token: str | None = None
        self._token_expires_at: float = 0.0
        self._catalogue: list[ProductRef] = []
        self._catalogue_fetched_at: float = 0.0
        self._categories: list[CategoryRef] = []
        self._categories_fetched_at: float = 0.0

    async def _authenticated_client(self) -> httpx.AsyncClient:
        token = await self._get_token()
        return httpx.AsyncClient(base_url=self._base, headers={"Authorization": f"Bearer {token}"}, timeout=30)

    async def _get_token(self) -> str:
        if self._token and time.monotonic() < self._token_expires_at:
            return self._token
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self._base}/auth/login",
                json={"email": configuration.service_account_email, "password": configuration.service_account_password},
            )
            response.raise_for_status()
            self._token = response.json()["accessToken"]
            self._token_expires_at = time.monotonic() + _ACCESS_TOKEN_LIFETIME_SECONDS - _TOKEN_SAFETY_MARGIN_SECONDS
            return self._token

    async def product_catalogue(self) -> list[ProductRef]:
        """Cached list of {id, sku, nameEn, nameAr} used for matching a product mention."""
        if self._catalogue and time.monotonic() - self._catalogue_fetched_at < _CATALOGUE_TTL_SECONDS:
            return self._catalogue
        async with await self._authenticated_client() as client:
            response = await client.get("/products")
            response.raise_for_status()
            items = response.json()["items"]
        self._catalogue = [ProductRef(id=p["id"], sku=p["sku"], name_en=p["nameEn"], name_ar=p["nameAr"]) for p in items]
        self._catalogue_fetched_at = time.monotonic()
        return self._catalogue

    async def product_categories(self) -> list[CategoryRef]:
        """Cached list of {id, nameEn, nameAr} — used to resolve a category name a
        question mentions (e.g. "dairy and creamers") to a real categoryId."""
        if self._categories and time.monotonic() - self._categories_fetched_at < _CATALOGUE_TTL_SECONDS:
            return self._categories
        async with await self._authenticated_client() as client:
            response = await client.get("/product-categories")
            response.raise_for_status()
            items = response.json()
        self._categories = [CategoryRef(id=c["id"], name_en=c["nameEn"], name_ar=c["nameAr"]) for c in items]
        self._categories_fetched_at = time.monotonic()
        return self._categories

    async def search_products(self, category_id: str | None = None, low_stock_only: bool = False, search_text: str | None = None) -> list[dict]:
        params: dict[str, str] = {}
        if category_id:
            params["categoryId"] = category_id
        if low_stock_only:
            params["lowStock"] = "true"
        if search_text:
            params["search"] = search_text
        async with await self._authenticated_client() as client:
            response = await client.get("/products", params=params)
            response.raise_for_status()
            return response.json()["items"]

    async def product_detail(self, product_id: str) -> dict:
        async with await self._authenticated_client() as client:
            response = await client.get(f"/products/{product_id}")
            response.raise_for_status()
            return response.json()

    async def low_stock_products(self) -> list[dict]:
        async with await self._authenticated_client() as client:
            response = await client.get("/products", params={"lowStock": "true"})
            response.raise_for_status()
            return response.json()["items"]

    async def pending_recommendations(self) -> list[dict]:
        async with await self._authenticated_client() as client:
            response = await client.get("/recommendations", params={"status": "PENDING"})
            response.raise_for_status()
            return response.json()

    async def recent_movements(self, product_id: str, limit: int = 10) -> list[dict]:
        async with await self._authenticated_client() as client:
            response = await client.get("/stock-movements", params={"productId": product_id, "limit": limit})
            response.raise_for_status()
            return response.json()

    async def movements_since(self, product_id: str, movement_type: str, since_iso_date: str, limit: int = 5000) -> list[dict]:
        """Full trailing history for one product/type — used by demand forecasting
        (§8.2 Stage 2), not the capped `recent_movements` used by the assistant."""
        async with await self._authenticated_client() as client:
            response = await client.get(
                "/stock-movements",
                params={"productId": product_id, "type": movement_type, "from": since_iso_date, "limit": limit},
            )
            response.raise_for_status()
            return response.json()

    async def dashboard_summary(self) -> dict:
        async with await self._authenticated_client() as client:
            response = await client.get("/dashboard/summary")
            response.raise_for_status()
            return response.json()
