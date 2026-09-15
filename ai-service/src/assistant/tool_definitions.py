"""Tool schemas offered to the model (§8.4, broadened). Each one maps to a real,
deterministic backend query — the model picks which to call and with what
arguments, but never sees or states a figure that didn't come back from one of
these. Kept intentionally small (six tools) so a 1.5B model has a real chance of
picking correctly; see OPEN-QUESTIONS.md for the reliability trade-off recorded there.
"""

TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": (
                "Search or filter the product catalogue. Use for ANY question about which "
                "products are low, critical, out of stock, running low, about to finish, or "
                "need attention, as well as a product category or a general product listing — "
                "including combinations, e.g. 'critical items in the dairy category'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "Category name mentioned in the question, e.g. 'Dairy & Creamers'. Omit for all categories."},
                    "low_stock_only": {"type": "boolean", "description": "true for any question about low, critical, or out-of-stock products."},
                    "search_text": {"type": "string", "description": "A specific product name or keyword to search for. Omit if not searching by name."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_detail",
            "description": "Get the current stock level and shelf locations for one specific named product.",
            "parameters": {
                "type": "object",
                "properties": {"product_name": {"type": "string", "description": "The product's name or SKU as mentioned in the question."}},
                "required": ["product_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_reorder",
            "description": "Check whether one specific named product needs to be reordered right now.",
            "parameters": {
                "type": "object",
                "properties": {"product_name": {"type": "string", "description": "The product's name or SKU as mentioned in the question."}},
                "required": ["product_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_movements",
            "description": "Get recent stock movement history (goods in/out, transfers, adjustments) for one specific named product.",
            "parameters": {
                "type": "object",
                "properties": {"product_name": {"type": "string", "description": "The product's name or SKU as mentioned in the question."}},
                "required": ["product_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pending_recommendations",
            "description": "List all reorder recommendations currently awaiting administrator approval.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_summary",
            "description": "Get an overall summary: total products, total units in stock, and stock health counts (in-stock/low/critical/out-of-stock).",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]

# Forceful by design — testing on this hardware showed qwen2.5:1.5b will happily
# answer a data question from memory (or ask a clarifying question) instead of
# calling a tool unless told, explicitly, that it must.
TOOL_SYSTEM_PROMPT = {
    "en": "You are the Mizan inventory assistant. For ANY question about products, stock "
    "levels, categories, reordering, recommendations, or stock movements, you MUST call one "
    "of the available tools — never answer such a question from memory. Only reply directly, "
    "without calling a tool, for genuine small talk unrelated to inventory.",
    "ar": "أنت مساعد المخزون في نظام ميزان. لأي سؤال عن المنتجات أو مستويات المخزون أو "
    "الفئات أو إعادة الطلب أو التوصيات أو حركات المخزون، يجب عليك استدعاء إحدى الأدوات "
    "المتاحة — لا تُجب أبدًا على مثل هذا السؤال من الذاكرة. أجب مباشرة دون استدعاء أداة "
    "فقط في حال كان الحديث عامًا ولا علاقة له بالمخزون.",
}
