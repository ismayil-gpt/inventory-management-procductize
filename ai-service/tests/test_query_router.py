"""§15 — pure-function tests, no network/model calls."""
from src.assistant.query_router import CategoryRef, Intent, ProductRef, classify, clean_search_text, detect_severity_filter, match_category, match_product

CATEGORIES = [
    CategoryRef(id="c1", name_en="Dairy & Creamers", name_ar="الألبان والمبيضات"),
    CategoryRef(id="c2", name_en="Cleaning Supplies", name_ar="مواد التنظيف"),
    CategoryRef(id="c3", name_en="Hot Beverages", name_ar="المشروبات الساخنة"),
]

CATALOGUE = [
    ProductRef(id="p1", sku="PRD-0001", name_en="Arabic Coffee Powder 250g", name_ar="بن عربي مطحون 250غ"),
    ProductRef(id="p2", sku="PRD-0002", name_en="Instant Coffee 200g Jar", name_ar="قهوة سريعة التحضير 200غ"),
    ProductRef(id="p3", sku="PRD-0012", name_en="Sugar 1kg", name_ar="سكر 1كغ"),
]


def test_classify_stock_level():
    assert classify("How much coffee do we have?").intent == Intent.STOCK_LEVEL
    assert classify("Where is the sugar?").intent == Intent.STOCK_LEVEL


def test_classify_low_stock():
    assert classify("What products are low on stock?").intent == Intent.LOW_STOCK_LIST
    assert classify("what needs reorder").intent == Intent.LOW_STOCK_LIST


def test_classify_pending_recommendations():
    assert classify("What recommendations are pending approval?").intent == Intent.PENDING_RECOMMENDATIONS


def test_classify_recent_movements():
    assert classify("Show recent movements for sugar").intent == Intent.RECENT_MOVEMENTS


def test_classify_general_summary():
    assert classify("Give me a summary of stock").intent == Intent.GENERAL_SUMMARY


def test_classify_general_chat_for_off_topic():
    assert classify("what is the weather today").intent == Intent.GENERAL_CHAT


def test_classify_reorder_advice():
    assert classify("Should I reorder Bottled Water 1.5L (6s)?").intent == Intent.REORDER_ADVICE
    assert classify("do we need more sugar").intent == Intent.REORDER_ADVICE


def test_classify_tolerates_typos():
    # A spelling slip should not make the assistant refuse to answer (§8.4 usability).
    assert classify("shuld i reoder the sugar").intent == Intent.REORDER_ADVICE
    assert classify("hw much coffee do we hav").intent == Intent.STOCK_LEVEL


def test_classify_arabic_keywords():
    assert classify("كم لدينا من القهوة؟").intent == Intent.STOCK_LEVEL
    assert classify("ما هي المنتجات المنخفضة؟").intent == Intent.LOW_STOCK_LIST


def test_match_product_by_sku():
    assert match_product("stock of PRD-0012", CATALOGUE).id == "p3"


def test_match_product_full_name_substring():
    assert match_product("how much Sugar 1kg do we have", CATALOGUE).id == "p3"


def test_match_product_single_word_fragment_of_longer_name():
    # Regression: a plain similarity ratio undersells a short query against a
    # longer product name ("coffee" vs "Instant Coffee 200g Jar") — this is the
    # exact bug found testing against the real seeded catalogue (§8.4 hardware
    # validation). Word-overlap scoring must catch it.
    result = match_product("how much coffee do we have", CATALOGUE)
    assert result is not None
    assert result.id in ("p1", "p2")


def test_match_product_no_match_returns_none():
    assert match_product("how many staplers do we have", CATALOGUE) is None


def test_match_product_arabic():
    result = match_product("كم لدينا من السكر", CATALOGUE)
    assert result is not None
    assert result.id == "p3"


def test_match_product_arabic_with_trailing_question_mark():
    # Regression: an attached "؟" prevented "السكر؟" from substring-matching a
    # clean catalogue name, silently falling through to the fuzzy tier and
    # matching an unrelated product — found testing against the real catalogue.
    result = match_product("كم لدينا من السكر؟", CATALOGUE)
    assert result is not None
    assert result.id == "p3"


def test_match_product_english_with_trailing_question_mark():
    result = match_product("how much coffee do we have?", CATALOGUE)
    assert result is not None
    assert result.id in ("p1", "p2")


def test_reorder_advice_matches_product_with_pack_size_suffix():
    # Regression: reported live — "Should I reorder Bottled Water 1.5L (6s)?" was
    # never even attempted because REORDER_ADVICE didn't exist as an intent yet.
    water = ProductRef(id="p4", sku="PRD-0019", name_en="Bottled Water 1.5L (6s)", name_ar="مياه معبأة 1.5ل (6)")
    catalogue = CATALOGUE + [water]
    routed = classify("Should I reorder Bottled Water 1.5L (6s)?")
    assert routed.intent == Intent.REORDER_ADVICE
    result = match_product(routed.raw_text, catalogue)
    assert result is not None
    assert result.id == "p4"


def test_match_product_tolerates_typos_in_product_name():
    result = match_product("do we have any botled watr", [
        ProductRef(id="p4", sku="PRD-0019", name_en="Bottled Water 1.5L (6s)", name_ar="مياه معبأة")
    ])
    assert result is not None
    assert result.id == "p4"


def test_match_category_exact_name():
    assert match_category("Dairy & Creamers", CATEGORIES).id == "c1"


def test_match_category_loose_phrasing():
    # Regression: reported live — "dairy and creamers category" (model-extracted
    # argument, not the exact catalogue string) must still resolve.
    result = match_category("dairy and creamers", CATEGORIES)
    assert result is not None
    assert result.id == "c1"


def test_match_category_no_match_returns_none():
    assert match_category("electronics", CATEGORIES) is None


def test_match_category_arabic():
    result = match_category("الألبان", CATEGORIES)
    assert result is not None
    assert result.id == "c1"


def test_detect_severity_filter_critical():
    assert detect_severity_filter("which product is in critical status") == "CRITICAL"
    assert detect_severity_filter("what is the critical product") == "CRITICAL"


def test_detect_severity_filter_out_of_stock():
    assert detect_severity_filter("what is out of stock") == "OUT"


def test_detect_severity_filter_none_for_generic_low_stock():
    assert detect_severity_filter("what products are low on stock") is None


def test_classify_critical_routes_to_low_stock_list():
    # Regression: reported live — "critical" wasn't a recognised keyword at all,
    # so every rephrasing of "which product is critical" fell through to a flat
    # "couldn't find a clear match" refusal.
    assert classify("which product is in critical status").intent == Intent.LOW_STOCK_LIST
    assert classify("what is the critical product").intent == Intent.LOW_STOCK_LIST


def test_clean_search_text_drops_pure_noise():
    # Regression: reported live — a tool call echoed back search_text="critical",
    # which would have zero-matched every real product name.
    assert clean_search_text("critical") is None
    assert clean_search_text("critical stock") is None
    assert clean_search_text("") is None
    assert clean_search_text(None) is None


def test_clean_search_text_keeps_real_product_fragment():
    assert clean_search_text("bottled water") == "bottled water"
    assert clean_search_text("coffee") == "coffee"
