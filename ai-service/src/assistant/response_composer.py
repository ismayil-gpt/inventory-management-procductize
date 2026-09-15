"""Turns retrieved backend data into a natural-language answer (§8.4). The model
phrases the data — it never invents a number. §8.4 says the model "never generates
figures", and M1 testing on this hardware showed a small model can also, unprompted,
silently DROP real data from its phrasing. So this module verifies its own output:
every quantity/name from the source data must appear in the composed text, or the
composition is discarded in favour of a plain deterministic sentence built from the
same data — never a partial, unverified LLM answer.
"""
import re

from ..language_model.language_model_provider import LanguageModelProvider
from ..language_model.model_profiles import PROFILES
from ..shared.configuration import configuration
from .query_router import Intent

_SYSTEM_PROMPT = {
    "en": "You are the Mizan inventory assistant — helpful and clear, like a knowledgeable "
    "colleague, not a report generator. Rephrase the given data as one or two natural "
    "sentences. State only the facts given below — never add, remove, or invent a number, "
    "product, or location. Within that constraint, write with appropriate emphasis: if the "
    "data signals something needs attention, say so plainly rather than just listing numbers.",
    "ar": "أنت مساعد المخزون في نظام ميزان — مفيد وواضح، كأنك زميل مطّلع، لا مجرّد مولّد "
    "تقارير. أجب باللغة العربية فقط. أعد صياغة البيانات التالية في جملة أو جملتين طبيعيتين. "
    "اذكر فقط الحقائق الواردة أدناه — لا تضف أو تحذف أو تخترع أي رقم أو منتج أو موقع. ضمن "
    "هذا القيد، اكتب بالتشديد المناسب: إذا كانت البيانات تشير إلى أن شيئًا ما يحتاج انتباهًا، "
    "فقل ذلك بوضوح بدلاً من سرد الأرقام فقط.",
}

# Appended to the base prompt only for intents where the data itself already
# establishes urgency (a LOW_STOCK_LIST/REORDER_ADVICE result IS, by definition,
# at or below its reorder point — flagging that plainly and suggesting action is
# a grounded inference from the given data, not an invented fact). STOCK_LEVEL,
# RECENT_MOVEMENTS, etc. don't get this: their data has no reorder-point context,
# so a reorder judgement there would be an unsupported guess, not emphasis.
_URGENCY_GUIDANCE = {
    "en": " These items are at or below their reorder point, which is why they're being "
    "surfaced — reflect that: use words like \"critically low\" or \"running low\" where "
    "warranted by the numbers, and suggest reordering soon. Don't invent a suggested quantity.",
    "ar": " هذه المنتجات عند نقطة إعادة الطلب أو أقل، ولهذا يتم عرضها — اعكس ذلك: استخدم "
    "عبارات مثل \"منخفض جدًا\" أو \"على وشك النفاد\" عند وجود ما يبرر ذلك في الأرقام، واقترح "
    "إعادة الطلب قريبًا. لا تخترع كمية مقترحة.",
}
_URGENCY_INTENTS = (Intent.LOW_STOCK_LIST, Intent.REORDER_ADVICE)

_NO_DATA_MESSAGE = {
    "en": "I don't have enough information to answer that. Try asking about a specific product's stock, low-stock items, pending recommendations, or recent movements.",
    "ar": "لا تتوفر لدي معلومات كافية للإجابة عن ذلك. جرّب السؤال عن رصيد منتج معيّن، أو المنتجات منخفضة المخزون، أو التوصيات المعلّقة، أو الحركات الأخيرة.",
}

# General-chat mode (§8.4, broadened): answers off-topic or unmatched questions
# conversationally instead of a flat refusal. Guardrail is the point of this
# prompt — the model has NO real inventory data in this mode, so it must not
# state one, ever, even when asked directly.
_GENERAL_SYSTEM_PROMPT = {
    "en": "You are the Mizan inventory assistant. This message reached you only after the "
    "system already tried and failed to match it to a real inventory query. You have NOT "
    "been given any real inventory data. Rules, in order: (1) If the question is genuine "
    "general knowledge unrelated to this warehouse's inventory (e.g. a fact, a greeting, "
    "small talk), answer it normally and briefly. (2) Otherwise — if it's about this "
    "warehouse's products, stock, categories, or reordering — say in ONE short sentence "
    "that you couldn't find a clear match and ask the user to name the exact product or "
    "category, or rephrase. Do not speculate about what products or categories might exist "
    "or guess what could be low. NEVER state or guess a specific stock count, product name, "
    "warehouse category, or shelf location as if it were real, in either case.",
    "ar": "أنت مساعد المخزون في نظام ميزان. وصلت إليك هذه الرسالة فقط بعد أن حاول النظام "
    "مطابقتها بطلب مخزون حقيقي ولم ينجح. لم تُعطَ أي بيانات مخزون حقيقية. القواعد، بالترتيب: "
    "(١) إذا كان السؤال معرفة عامة حقيقية لا علاقة لها بمخزون هذا المستودع (حقيقة، تحية، "
    "حديث عام)، أجب عليه بشكل طبيعي وموجز. (٢) خلاف ذلك — إذا كان يتعلق بمنتجات هذا "
    "المستودع أو مخزونه أو فئاته أو إعادة الطلب — قل بجملة واحدة قصيرة إنك لم تجد تطابقًا "
    "واضحًا واطلب من المستخدم تسمية المنتج أو الفئة بدقة، أو إعادة الصياغة. لا تخمّن أي "
    "منتجات أو فئات قد تكون موجودة أو ما قد يكون منخفضًا. لا تذكر أو تخمّن أبدًا، في أي من "
    "الحالتين، رقم مخزون أو اسم منتج أو فئة مستودع أو موقع رف كأنه حقيقي.",
}
_GENERAL_FALLBACK = {
    "en": "I'm not sure how to help with that. I can answer questions about a product's stock and location, low-stock items, whether something needs reordering, pending recommendations, or recent movements.",
    "ar": "لست متأكدًا كيف أساعد في ذلك. يمكنني الإجابة عن أسئلة حول رصيد منتج وموقعه، أو المنتجات منخفضة المخزون، أو ما إذا كان أحد المنتجات بحاجة لإعادة الطلب، أو التوصيات المعلّقة، أو الحركات الأخيرة.",
}


class ComposedAnswer:
    def __init__(self, answer: str, sources: list[dict], is_development_model: bool):
        self.answer = answer
        self.sources = sources
        self.is_development_model = is_development_model


def _extract_facts(data: dict | list) -> list[str]:
    """Every number and short string in the retrieved data — the composed answer must
    mention each of these, or verification fails."""
    facts: list[str] = []

    def walk(node):
        if isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
        elif isinstance(node, (int, float)) and not isinstance(node, bool):
            facts.append(str(node))
        elif isinstance(node, str) and 0 < len(node) <= 60:
            facts.append(node)

    walk(data)
    return facts


_ARABIC_LETTER = re.compile(r"[؀-ۿ]")
_LATIN_LETTER = re.compile(r"[A-Za-z]")


def _is_in_requested_language(answer: str, language: str) -> bool:
    """Found in testing: asked for Arabic, qwen2.5:1.5b sometimes answers fluently
    in English instead — numbers all correct, verification would pass, but it's
    the wrong language entirely. Numeric verification alone can't catch this, so
    check the script actually matches what was requested. SKUs/designators (Latin
    by design, §10 — never translated) mean an Arabic answer still has some Latin
    characters, so this compares which script dominates rather than requiring purity."""
    arabic_count = len(_ARABIC_LETTER.findall(answer))
    latin_count = len(_LATIN_LETTER.findall(answer))
    if arabic_count + latin_count == 0:
        return True  # no letters to judge from (e.g. a number-only answer)
    if language == "ar":
        return arabic_count >= latin_count
    return latin_count >= arabic_count


def _verify(answer: str, facts: list[str], language: str) -> bool:
    if not _is_in_requested_language(answer, language):
        return False
    numeric_facts = [f for f in facts if re.fullmatch(r"-?\d+(\.\d+)?", f)]
    return all(f in answer for f in numeric_facts)


def _humanize_key(key: str) -> str:
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", key)
    return spaced[:1].upper() + spaced[1:]


def _format_for_prompt(data, indent: int = 0) -> str:
    """Plain labeled text, not a Python dict repr — a small model reads
    "In stock: 42" far more reliably than "{'inStock': 42}", which is exactly
    the kind of ambiguity that produced a mislabeled ("units" vs "products")
    answer in testing on this hardware."""
    pad = "  " * indent
    lines: list[str] = []
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, (dict, list)):
                lines.append(f"{pad}{_humanize_key(key)}:")
                lines.append(_format_for_prompt(value, indent + 1))
            else:
                lines.append(f"{pad}{_humanize_key(key)}: {value}")
    elif isinstance(data, list):
        for i, item in enumerate(data, 1):
            lines.append(f"{pad}{i}.")
            lines.append(_format_for_prompt(item, indent + 1))
    else:
        lines.append(f"{pad}{data}")
    return "\n".join(lines)


def _deterministic_fallback(intent: Intent, data: dict | list, language: str) -> str:
    """Plain, template-built sentence used when there's no data, or when the LLM's
    phrasing fails verification. Never LLM-generated (§8.3's principle, extended)."""
    en = language == "en"
    if intent == Intent.STOCK_LEVEL and isinstance(data, dict):
        positions = data.get("positions", [])
        if en:
            where = "; ".join(f"{p['designator']}: {p['quantity']}" for p in positions) or "no locations recorded"
            return f"{data['nameEn']} (SKU {data['sku']}): {data['totalStock']} units in stock. {where}."
        where = "؛ ".join(f"{p['designator']}: {p['quantity']}" for p in positions) or "لا توجد مواقع مسجلة"
        return f"{data['nameAr']} (SKU {data['sku']}): {data['totalStock']} وحدة في المخزون. {where}."

    if intent == Intent.LOW_STOCK_LIST and isinstance(data, list):
        if not data:
            return "Good news — nothing is currently low on stock." if en else "خبر جيد — لا توجد منتجات منخفضة المخزون حاليًا."
        items = ", ".join(f"{p['nameEn']} (only {p['totalStock']} left)" if en else f"{p['nameAr']} (تبقّى {p['totalStock']} فقط)" for p in data)
        plural = "product needs" if len(data) == 1 else "products need"
        if en:
            return f"{len(data)} {plural} attention — worth reordering soon: {items}."
        return f"{len(data)} منتج(ات) بحاجة للمتابعة وإعادة الطلب قريبًا: {items}."

    if intent == Intent.PENDING_RECOMMENDATIONS and isinstance(data, list):
        if not data:
            return "No recommendations are pending approval." if en else "لا توجد توصيات بانتظار الموافقة."
        items = ", ".join(f"{r['nameEn']} ({r['suggestedQty']})" if en else f"{r['nameAr']} ({r['suggestedQty']})" for r in data)
        return (f"{len(data)} recommendation(s) pending: {items}." if en else f"{len(data)} توصية/توصيات معلّقة: {items}.")

    if intent == Intent.RECENT_MOVEMENTS and isinstance(data, list):
        if not data:
            return "No recent movements recorded for this product." if en else "لا توجد حركات حديثة مسجّلة لهذا المنتج."
        items = "; ".join(f"{m['type']} {m['quantity']}" for m in data[:5])
        return (f"Recent movements: {items}." if en else f"الحركات الأخيرة: {items}.")

    if intent == Intent.REORDER_ADVICE and isinstance(data, dict):
        below = data["totalStock"] <= data["reorderPoint"]
        if en:
            if below:
                return (f"Yes — {data['nameEn']} (SKU {data['sku']}) is at or below its reorder point: "
                        f"{data['totalStock']} units in stock against a reorder point of {data['reorderPoint']}. "
                        f"Worth reordering soon.")
            return (f"No — {data['nameEn']} (SKU {data['sku']}) is fine for now: {data['totalStock']} units in "
                    f"stock, above its reorder point of {data['reorderPoint']}.")
        if below:
            return (f"نعم — {data['nameAr']} (SKU {data['sku']}) عند نقطة إعادة الطلب أو أقل: "
                    f"{data['totalStock']} وحدة في المخزون مقابل نقطة إعادة الطلب البالغة {data['reorderPoint']}. "
                    f"يُستحسن إعادة الطلب قريبًا.")
        return (f"لا — {data['nameAr']} (SKU {data['sku']}) بحالة جيدة حاليًا: {data['totalStock']} وحدة في "
                f"المخزون، أعلى من نقطة إعادة الطلب البالغة {data['reorderPoint']}.")

    if intent == Intent.GENERAL_SUMMARY and isinstance(data, dict):
        s = data["stockStatus"]
        if en:
            return (f"{data['products']} products, {data['totalUnits']} units in stock. "
                    f"{s['inStock']} in stock, {s['low']} low, {s['critical']} critical, {s['outOfStock']} out. "
                    f"{data['needsReorder']} need reordering.")
        return (f"{data['products']} منتج، {data['totalUnits']} وحدة في المخزون. "
                f"{s['inStock']} متوفر، {s['low']} منخفض، {s['critical']} حرج، {s['outOfStock']} نافد. "
                f"{data['needsReorder']} بحاجة لإعادة الطلب.")

    return _NO_DATA_MESSAGE[language]


async def compose(intent: Intent, data: dict | list | None, language: str, provider: LanguageModelProvider) -> ComposedAnswer:
    profile = PROFILES[configuration.language_model_profile]
    is_dev = not profile.arabic_verified if language == "ar" else False

    if data is None or (isinstance(data, list) and len(data) == 0 and intent not in (Intent.LOW_STOCK_LIST, Intent.PENDING_RECOMMENDATIONS, Intent.RECENT_MOVEMENTS)):
        return ComposedAnswer(answer=_NO_DATA_MESSAGE[language], sources=[], is_development_model=is_dev)

    fallback = _deterministic_fallback(intent, data, language)
    facts = _extract_facts(data)

    system_prompt = _SYSTEM_PROMPT[language]
    if intent in _URGENCY_INTENTS:
        system_prompt += _URGENCY_GUIDANCE[language]

    try:
        composed = await provider.complete(
            system_prompt=system_prompt,
            user_prompt=f"Data:\n{_format_for_prompt(data)}\n\nWrite the natural-language answer now.",
            language=language,
        )
        composed = composed.strip()
    except Exception:
        composed = ""

    answer = composed if composed and _verify(composed, facts, language) else fallback
    return ComposedAnswer(answer=answer, sources=[], is_development_model=is_dev)


async def compose_general(text: str, language: str, provider: LanguageModelProvider, could_not_find_product: bool = False) -> ComposedAnswer:
    """General-chat mode: no retrieved data, so no numeric verification is possible
    or needed — but the language-conformance check still applies (the same wrong-
    language failure can happen here too), and the guardrail is otherwise entirely
    in the system prompt (see `_GENERAL_SYSTEM_PROMPT` above).

    Arabic is a deliberate, tested exception: found live on this hardware, even
    with the strict prompt above, qwen2.5:1.5b fabricated plausible-sounding but
    entirely fake sub-category names in Arabic here (no real product/category in
    the catalogue matched what it said) — with no number in the answer to catch
    via `_verify`. English handled the identical scenario correctly in testing
    (e.g. answered "capital of France" correctly, no fabrication observed). Given
    that asymmetry, and that this tier is only reached after both the keyword
    router and tool-calling already failed to resolve the question (§18 —
    deterministic over generative when the model can't be trusted), Arabic here
    skips the free-generation call entirely and returns the fixed fallback
    message. This is a real UX cost for genuine Arabic small talk, accepted
    deliberately over the alternative: inventing warehouse categories that don't
    exist. Revisit if a future model proves more reliable (see the same finding
    recorded in OPEN-QUESTIONS.md and language-model-validation.md).
    """
    profile = PROFILES[configuration.language_model_profile]
    is_dev = not profile.arabic_verified if language == "ar" else False

    if language == "ar":
        return ComposedAnswer(answer=_GENERAL_FALLBACK["ar"], sources=[], is_development_model=is_dev)

    system_prompt = _GENERAL_SYSTEM_PROMPT[language]
    if could_not_find_product:
        system_prompt += (
            " The user appears to be asking about a specific product, but no confident "
            "catalogue match was found — say so briefly and ask them to name the exact "
            "product or check the spelling."
            if language == "en"
            else " يبدو أن المستخدم يسأل عن منتج معيّن، لكن لم يتم العثور على تطابق واضح في "
            "الكتالوج — اذكر ذلك بإيجاز واطلب منه تسمية المنتج بدقة أو التحقق من الإملاء."
        )

    try:
        composed = (await provider.complete(system_prompt=system_prompt, user_prompt=text, language=language)).strip()
    except Exception:
        composed = ""

    answer = composed if composed and _is_in_requested_language(composed, language) else _GENERAL_FALLBACK[language]
    return ComposedAnswer(answer=answer, sources=[], is_development_model=is_dev)
