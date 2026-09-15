"""POST /assistant/query — internal only, called by the backend's ai-service-client
(§7, §8.4). Two-tier routing:
  1. Tool-calling (general): the model picks one of a small set of real backend
     queries and its arguments, from the free-form question — handles phrasing and
     combinations (e.g. a category + low-stock filter) no hand-written keyword rule
     anticipated. Falls through if the model doesn't produce a usable tool call
     (small local models are not fully reliable at this — see OPEN-QUESTIONS.md).
  2. Keyword routing (reliable fallback): the original fixed-intent router, kept
     exactly as-is as the safety net under tier 1.
Either way, every number the assistant states still traces to a real backend call
— response_composer's verification is unchanged and applies in both tiers.
"""
from fastapi import APIRouter
from pydantic import BaseModel

from ..language_model.ollama_provider import OllamaProvider
from .inventory_data_retriever import InventoryDataRetriever
from .query_router import Intent, ProductRef, classify, clean_search_text, detect_severity_filter, match_category, match_product
from .response_composer import compose, compose_general
from .tool_definitions import TOOL_DEFINITIONS, TOOL_SYSTEM_PROMPT

router = APIRouter(prefix="/assistant", tags=["assistant"])

_retriever = InventoryDataRetriever()
_provider = OllamaProvider()

# Keyword-tier intents that need a product match before anything else can happen.
_PRODUCT_REQUIRED_INTENTS = (Intent.STOCK_LEVEL, Intent.RECENT_MOVEMENTS, Intent.REORDER_ADVICE)


class AssistantQueryRequest(BaseModel):
    text: str
    language: str


class Source(BaseModel):
    type: str
    id: str
    label: str
    value: object = None


class AssistantQueryResponse(BaseModel):
    answer: str
    sources: list[Source]
    isDevelopmentModel: bool


async def _find_product(text: str) -> ProductRef | None:
    catalogue = await _retriever.product_catalogue()
    return match_product(text, catalogue)


async def _product_detail_response(product: ProductRef) -> tuple[object, list[Source]]:
    detail = await _retriever.product_detail(product.id)
    source = Source(
        type="product", id=detail["id"], label=f"{detail['sku']} — {detail['nameEn']}",
        value={"totalStock": detail["totalStock"], "positions": detail["positions"]},
    )
    speak_data = {
        "sku": detail["sku"], "nameEn": detail["nameEn"], "nameAr": detail["nameAr"],
        "totalStock": detail["totalStock"],
        "positions": [{"designator": p["designator"], "quantity": p["quantity"]} for p in detail["positions"]],
    }
    return speak_data, [source]


async def _recent_movements_response(product: ProductRef) -> tuple[object, list[Source]]:
    movements = await _retriever.recent_movements(product.id)
    sources = [Source(type="movement", id=m["id"], label=f"{m['type']} {m['quantity']}", value=m) for m in movements]
    speak_data = [{"type": m["type"], "quantity": m["quantity"]} for m in movements]
    return speak_data, sources


async def _handle_reorder_advice(product: ProductRef, language: str) -> AssistantQueryResponse:
    detail = await _retriever.product_detail(product.id)
    pending = await _retriever.pending_recommendations()
    matching_rec = next((r for r in pending if r["productId"] == product.id), None)

    product_source = Source(
        type="product", id=detail["id"], label=f"{detail['sku']} — {detail['nameEn']}",
        value={"totalStock": detail["totalStock"], "reorderPoint": detail["reorderPoint"], "status": detail["status"]},
    )

    if matching_rec:
        # A formal recommendation already exists — reuse its deterministic §8.3
        # reasoning verbatim rather than re-phrasing already-vetted text through
        # the LLM for no benefit and needless risk.
        reasoning = matching_rec["reasoningAr"] if language == "ar" else matching_rec["reasoningEn"]
        prefix = "نعم — " if language == "ar" else "Yes — "
        rec_source = Source(
            type="recommendation", id=matching_rec["id"], label=detail["nameEn"],
            value={"suggestedQty": matching_rec["suggestedQty"], "reasonCode": matching_rec["reasonCode"]},
        )
        return AssistantQueryResponse(answer=f"{prefix}{reasoning}", sources=[product_source, rec_source], isDevelopmentModel=False)

    speak_data = {
        "sku": detail["sku"], "nameEn": detail["nameEn"], "nameAr": detail["nameAr"],
        "totalStock": detail["totalStock"], "reorderPoint": detail["reorderPoint"],
    }
    composed = await compose(Intent.REORDER_ADVICE, speak_data, language, _provider)
    return AssistantQueryResponse(answer=composed.answer, sources=[product_source], isDevelopmentModel=composed.is_development_model)


async def _pending_recommendations_response(language: str) -> AssistantQueryResponse:
    recs = await _retriever.pending_recommendations()
    sources = [Source(type="recommendation", id=r["id"], label=r["nameEn"], value={"suggestedQty": r["suggestedQty"], "reasonCode": r["reasonCode"]}) for r in recs]
    speak_data = [{"nameEn": r["nameEn"], "nameAr": r["nameAr"], "suggestedQty": r["suggestedQty"]} for r in recs]
    composed = await compose(Intent.PENDING_RECOMMENDATIONS, speak_data, language, _provider)
    return AssistantQueryResponse(answer=composed.answer, sources=sources, isDevelopmentModel=composed.is_development_model)


async def _dashboard_summary_response(language: str) -> AssistantQueryResponse:
    summary = await _retriever.dashboard_summary()
    composed = await compose(Intent.GENERAL_SUMMARY, summary, language, _provider)
    return AssistantQueryResponse(
        answer=composed.answer, sources=[Source(type="dashboard", id="summary", label="Dashboard summary", value=summary)],
        isDevelopmentModel=composed.is_development_model,
    )


async def _search_products_response(arguments: dict, original_text: str, language: str) -> AssistantQueryResponse:
    category_id = None
    if arguments.get("category"):
        categories = await _retriever.product_categories()
        matched = match_category(str(arguments["category"]), categories)
        if matched:
            category_id = matched.id

    items = await _retriever.search_products(
        category_id=category_id,
        low_stock_only=bool(arguments.get("low_stock_only")),
        # A tool call sometimes echoes generic status vocabulary back as
        # search_text (e.g. "critical") — that would silently zero out real
        # results, since no product name contains that word.
        search_text=clean_search_text(arguments.get("search_text")),
    )

    # "low stock" covers LOW+CRITICAL+OUT together; a question specifically about
    # "critical" or "out of stock" items wants only that narrower slice — found
    # live: "which is the critical product" should name the one critical item,
    # not the whole low-stock list.
    severity = detect_severity_filter(original_text)
    if severity == "CRITICAL":
        items = [p for p in items if p["status"] in ("CRITICAL", "OUT")]
    elif severity == "OUT":
        items = [p for p in items if p["status"] == "OUT"]

    sources = [Source(type="product", id=p["id"], label=p["nameEn"], value={"totalStock": p["totalStock"], "reorderPoint": p["reorderPoint"], "status": p["status"]}) for p in items]
    # Kept as a plain list — matches Intent.LOW_STOCK_LIST's fallback template shape
    # regardless of whether a category filter narrowed it server-side. Verification
    # only checks numbers, never string facts, so there's no correctness cost to
    # not separately naming the category here.
    speak_data = [{"nameEn": p["nameEn"], "nameAr": p["nameAr"], "totalStock": p["totalStock"]} for p in items]
    composed = await compose(Intent.LOW_STOCK_LIST, speak_data, language, _provider)
    return AssistantQueryResponse(answer=composed.answer, sources=sources, isDevelopmentModel=composed.is_development_model)


async def _dispatch_tool(name: str, arguments: dict, original_text: str, language: str) -> AssistantQueryResponse | None:
    """Executes a tool the model chose to call. Returns None only for a tool name
    the model hallucinated (not one we defined) — callers fall back to keyword
    routing in that case. An unresolved product/category is NOT a None case: the
    model did understand the question, it's just a lookup miss, so it gets a
    guarded clarifying reply rather than silently trying a different strategy."""
    if name == "search_products":
        return await _search_products_response(arguments, original_text, language)

    if name in ("get_product_detail", "check_reorder", "get_recent_movements"):
        product_name = str(arguments.get("product_name") or "")
        product = await _find_product(product_name)
        if product is None:
            composed = await compose_general(original_text, language, _provider, could_not_find_product=True)
            return AssistantQueryResponse(answer=composed.answer, sources=[], isDevelopmentModel=composed.is_development_model)
        if name == "check_reorder":
            return await _handle_reorder_advice(product, language)
        if name == "get_product_detail":
            speak_data, sources = await _product_detail_response(product)
        else:
            speak_data, sources = await _recent_movements_response(product)
        intent = Intent.STOCK_LEVEL if name == "get_product_detail" else Intent.RECENT_MOVEMENTS
        composed = await compose(intent, speak_data, language, _provider)
        return AssistantQueryResponse(answer=composed.answer, sources=sources, isDevelopmentModel=composed.is_development_model)

    if name == "get_pending_recommendations":
        return await _pending_recommendations_response(language)

    if name == "get_dashboard_summary":
        return await _dashboard_summary_response(language)

    return None


async def _try_tool_call(text: str, language: str) -> AssistantQueryResponse | None:
    try:
        result = await _provider.complete_with_tools(TOOL_SYSTEM_PROMPT[language], text, TOOL_DEFINITIONS, language=language)
    except Exception:
        return None
    if not result.tool_calls:
        return None
    call = result.tool_calls[0]
    return await _dispatch_tool(call.name, call.arguments, text, language)


async def _handle_keyword_routed(routed_intent: Intent, text: str, language: str) -> AssistantQueryResponse:
    """The original fixed-intent router (§8.4) — precise and well-tested for the
    phrasing it recognises. Only called for an intent other than GENERAL_CHAT;
    the caller decides what to do when nothing here matched."""
    if routed_intent in _PRODUCT_REQUIRED_INTENTS:
        product = await _find_product(text)
        if product is None:
            composed = await compose_general(text, language, _provider, could_not_find_product=True)
            return AssistantQueryResponse(answer=composed.answer, sources=[], isDevelopmentModel=composed.is_development_model)
        if routed_intent == Intent.REORDER_ADVICE:
            return await _handle_reorder_advice(product, language)
        speak_data, sources = (await _product_detail_response(product)) if routed_intent == Intent.STOCK_LEVEL else (await _recent_movements_response(product))
        composed = await compose(routed_intent, speak_data, language, _provider)
        return AssistantQueryResponse(answer=composed.answer, sources=sources, isDevelopmentModel=composed.is_development_model)

    if routed_intent == Intent.LOW_STOCK_LIST:
        return await _search_products_response({"low_stock_only": True}, text, language)

    if routed_intent == Intent.PENDING_RECOMMENDATIONS:
        return await _pending_recommendations_response(language)

    # GENERAL_SUMMARY
    return await _dashboard_summary_response(language)


@router.post("/query", response_model=AssistantQueryResponse)
async def query(request: AssistantQueryRequest) -> AssistantQueryResponse:
    """Priority order, deliberate: the keyword router (§8.4) is precise and
    well-tested for phrasing it recognises — e.g. "should I reorder X" reliably
    reuses a real recommendation's exact reasoning via that path. Tool-calling
    only runs for what the keyword router's fixed menu can't express at all
    (found live: it otherwise sometimes picked a less useful tool for a question
    the keyword router already handled precisely). Tool-calling gets one retry
    before falling to guarded general chat — found live: the small model doesn't
    reliably produce a tool call on the first attempt, especially in Arabic, and
    a second attempt often succeeds where the first didn't."""
    routed = classify(request.text)
    if routed.intent != Intent.GENERAL_CHAT:
        return await _handle_keyword_routed(routed.intent, request.text, request.language)

    for _ in range(2):
        tool_response = await _try_tool_call(request.text, request.language)
        if tool_response is not None:
            return tool_response

    composed = await compose_general(request.text, request.language, _provider)
    return AssistantQueryResponse(answer=composed.answer, sources=[], isDevelopmentModel=composed.is_development_model)
