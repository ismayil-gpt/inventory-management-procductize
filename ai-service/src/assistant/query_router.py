"""Classify a user's question into a structured intent + optional product mention.
Ref: CLAUDE.md §8.4. Pure functions — no network, no model calls — deterministic and
unit-testable (§15). Keyword rules only (no FAISS/embeddings — see OPEN-QUESTIONS.md #9).
"""
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from enum import Enum

# Punctuation stripped before matching — otherwise "coffee?" or "السكر؟" (with the
# Arabic question mark attached) never substring-matches a clean catalogue name.
# Found via real-query testing: a trailing "؟" alone was enough to silently fall
# through to the fuzzy tier and match the wrong product.
_PUNCTUATION = re.compile(r"[?.,!:;؟،]")


class Intent(str, Enum):
    REORDER_ADVICE = "reorder_advice"               # should I reorder <product>?
    STOCK_LEVEL = "stock_level"                      # how much / where is <product>
    LOW_STOCK_LIST = "low_stock_list"                # what's low / needs reordering
    PENDING_RECOMMENDATIONS = "pending_recommendations"  # what's awaiting approval
    RECENT_MOVEMENTS = "recent_movements"            # recent activity for <product>
    GENERAL_SUMMARY = "general_summary"              # overall stock summary
    GENERAL_CHAT = "general_chat"                    # off-topic or unmatched — still answer, no data


@dataclass(frozen=True)
class ProductRef:
    id: str
    sku: str
    name_en: str
    name_ar: str


@dataclass(frozen=True)
class CategoryRef:
    id: str
    name_en: str
    name_ar: str


@dataclass(frozen=True)
class RoutedQuery:
    intent: Intent
    raw_text: str


# Ordered — first match wins. REORDER_ADVICE and RECENT_MOVEMENTS checked before the
# generic LOW_STOCK_LIST/STOCK_LEVEL fallbacks since they're more specific phrasing.
_KEYWORDS: list[tuple[Intent, list[str]]] = [
    (Intent.REORDER_ADVICE, [
        "should i reorder", "should we reorder", "need to reorder", "need to order",
        "time to reorder", "time to order", "do we need more", "should i order",
        "should we order", "worth reordering", "worth ordering",
        "هل يجب أن أعيد الطلب", "هل نحتاج لإعادة الطلب", "هل يجب إعادة الطلب", "هل نحتاج طلب",
    ]),
    (Intent.RECENT_MOVEMENTS, [
        "recent", "history", "movement", "activity", "last scanned", "recently",
        "الحركة", "الحركات", "سجل", "مؤخر", "آخر",
    ]),
    (Intent.LOW_STOCK_LIST, [
        "low stock", "low on", "running low", "need reorder", "needs reorder", "what's low",
        "critical", "out of stock", "about to finish", "about to run out", "running out",
        "منخفض", "ناقص", "يحتاج طلب", "قارب على النفاد", "حرج", "نفد", "أوشك على النفاد",
    ]),
    (Intent.PENDING_RECOMMENDATIONS, [
        "pending", "awaiting approval", "recommendation", "need approval", "to approve",
        "توصية", "توصيات", "بانتظار الموافقة", "قيد الانتظار",
    ]),
    (Intent.GENERAL_SUMMARY, [
        "summary", "overview", "how are we doing", "dashboard", "overall",
        "ملخص", "نظرة عامة", "الوضع العام",
    ]),
    (Intent.STOCK_LEVEL, [
        "how much", "how many", "stock of", "where is", "where are", "location of",
        "كم", "أين", "موقع", "رصيد",
    ]),
]

# Every keyword phrase, flattened, for the fuzzy (typo-tolerant) pass.
_ALL_KEYWORDS: list[tuple[Intent, str]] = [(intent, kw) for intent, kws in _KEYWORDS for kw in kws]

_FUZZY_INTENT_THRESHOLD = 0.82


def _fuzzy_classify(lower_text: str) -> Intent | None:
    """Typo tolerance: no exact keyword appeared, so compare the query's own
    n-word windows against every keyword phrase and take the best match above a
    tight threshold. Deliberately conservative (0.82) — a loose fuzzy match here
    would misroute the question, not just misname a product."""
    words = lower_text.split()
    best: tuple[float, Intent | None] = (0.0, None)
    for intent, keyword in _ALL_KEYWORDS:
        kw_len = len(keyword.split())
        for i in range(max(1, len(words) - kw_len + 1)):
            window = " ".join(words[i : i + kw_len])
            score = SequenceMatcher(None, window, keyword).ratio()
            if score > best[0]:
                best = (score, intent)
    return best[1] if best[0] >= _FUZZY_INTENT_THRESHOLD else None


def classify(text: str) -> RoutedQuery:
    """§8.4 intent routing, with typo tolerance (a spelling slip should not make
    the assistant refuse to answer). Exact keyword match first; if nothing hits,
    a conservative fuzzy pass; if still nothing, GENERAL_CHAT — the assistant
    still responds (conversationally, with no fabricated inventory data) rather
    than a flat refusal for anything it doesn't recognise as a structured query."""
    lower = text.lower()
    for intent, keywords in _KEYWORDS:
        if any(kw in lower for kw in keywords):
            return RoutedQuery(intent=intent, raw_text=text)

    fuzzy = _fuzzy_classify(lower)
    if fuzzy is not None:
        return RoutedQuery(intent=fuzzy, raw_text=text)

    return RoutedQuery(intent=Intent.GENERAL_CHAT, raw_text=text)


def _strip_arabic_article(word: str) -> str:
    """Strip a leading definite article ("ال" — "the") so "السكر" (the sugar)
    matches a catalogue entry named plainly "سكر" (sugar). Only for words long
    enough that stripping can't reduce them to nothing meaningful."""
    if word.startswith("ال") and len(word) > 4:
        return word[2:]
    return word


def _normalize(s: str) -> str:
    """Loose match key: casefold, strip punctuation, strip common Arabic
    diacritics/alef variants."""
    s = _PUNCTUATION.sub(" ", s).strip().casefold()
    for src, dst in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ة", "ه"), ("ى", "ي")):
        s = s.replace(src, dst)
    return s


_STOPWORDS = {
    "how", "much", "many", "do", "we", "have", "is", "are", "the", "of", "in", "stock",
    "where", "what", "a", "an", "for", "and", "to", "should", "reorder", "order", "need",
    "كم", "لدينا", "هل", "من", "في", "ما", "أين", "الى", "يجب", "نحتاج", "اعيد", "الطلب",
}


def match_product(text: str, catalogue: list[ProductRef], threshold: float = 0.5) -> ProductRef | None:
    """Find the product a question is most likely referring to.
    1. Exact SKU match.
    2. Full product name is a substring of the query (product mentioned verbatim).
    3. Word-overlap: how many significant query words appear inside the product's
       name — handles "how much coffee" against "Instant Coffee 200g Jar" (the
       query is a fragment of a longer name, so a plain similarity ratio undersells
       it). Most overlapping words wins.
    4. `difflib` fuzzy ratio as a last resort, for typos in the product name itself
       (e.g. "botled watr" for "Bottled Water").
    No embeddings (OPEN-QUESTIONS.md #9)."""
    norm_text = _normalize(text)

    for product in catalogue:
        if product.sku.casefold() in norm_text:
            return product

    for product in catalogue:
        if _normalize(product.name_en) in norm_text or _normalize(product.name_ar) in norm_text:
            return product

    query_words = [_strip_arabic_article(w) for w in norm_text.split() if len(w) >= 3 and w not in _STOPWORDS]
    if query_words:
        best_overlap: tuple[int, ProductRef | None] = (0, None)
        for product in catalogue:
            names = f"{_normalize(product.name_en)} {_normalize(product.name_ar)}"
            score = sum(1 for w in query_words if w in names)
            if score > best_overlap[0]:
                best_overlap = (score, product)
        if best_overlap[0] > 0:
            return best_overlap[1]

    best: tuple[float, ProductRef | None] = (0.0, None)
    words = norm_text.split()
    for product in catalogue:
        for name in (_normalize(product.name_en), _normalize(product.name_ar)):
            for window_size in (1, 2, 3):
                for i in range(max(1, len(words) - window_size + 1)):
                    phrase = " ".join(words[i : i + window_size])
                    score = SequenceMatcher(None, phrase, name).ratio()
                    if score > best[0]:
                        best = (score, product)

    return best[1] if best[0] >= threshold else None


def match_category(name: str, categories: list[CategoryRef], threshold: float = 0.4) -> CategoryRef | None:
    """Resolve a category name mentioned in a question (e.g. "dairy and creamers",
    possibly from a tool call the model made up in its own words) to a real
    category. Substring match first, then fuzzy ratio — categories are short
    names, so a looser threshold than product matching is fine here."""
    if not name:
        return None
    norm_query = _normalize(name)

    for category in categories:
        if _normalize(category.name_en) in norm_query or norm_query in _normalize(category.name_en):
            return category
        if _normalize(category.name_ar) in norm_query or norm_query in _normalize(category.name_ar):
            return category

    best: tuple[float, CategoryRef | None] = (0.0, None)
    for category in categories:
        for cat_name in (_normalize(category.name_en), _normalize(category.name_ar)):
            score = SequenceMatcher(None, norm_query, cat_name).ratio()
            if score > best[0]:
                best = (score, category)

    return best[1] if best[0] >= threshold else None


# A "low stock" question can mean three different severities. Product.status
# values (backend's computeStatus): IN_STOCK | LOW | CRITICAL | OUT. Detecting
# which one was actually asked about lets "which product is critical" return
# just that one item instead of the whole low+critical+out list.
_CRITICAL_WORDS = ("critical", "حرج")
_OUT_OF_STOCK_WORDS = ("out of stock", "ran out", "نفد", "نافد تمامًا")


def detect_severity_filter(text: str) -> str | None:
    """Returns 'CRITICAL', 'OUT', or None (any of low/critical/out — the general case)."""
    lower = text.lower()
    if any(w in lower for w in _OUT_OF_STOCK_WORDS):
        return "OUT"
    if any(w in lower for w in _CRITICAL_WORDS):
        return "CRITICAL"
    return None


# Generic inventory/status vocabulary that a tool call sometimes echoes back as
# `search_text` (e.g. arguments={"search_text": "critical"}) — found live: this
# silently zeroes out real results, since no product name contains the word
# "critical". None of these are ever a real product-name fragment on their own.
_SEARCH_TEXT_NOISE_WORDS = {
    "critical", "low", "stock", "reorder", "status", "product", "products", "the",
    "all", "item", "items", "out", "of", "a", "an", "any",
    "حرج", "منخفض", "مخزون", "المخزون", "منتج", "منتجات", "الكل", "حالة",
}


def clean_search_text(search_text: str | None) -> str | None:
    """Drops a tool-call-supplied search_text if it's pure generic vocabulary
    rather than an actual product-name fragment — a bogus term here silently
    excludes real results, which is worse than not filtering at all."""
    if not search_text:
        return None
    words = _normalize(search_text).split()
    if words and all(w in _SEARCH_TEXT_NOISE_WORDS for w in words):
        return None
    return search_text
