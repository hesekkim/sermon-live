from services.text_filter import should_suppress_translation_text


def test_empty_text_is_suppressed():
    assert should_suppress_translation_text("  ") is True


def test_german_translation_is_kept():
    assert should_suppress_translation_text("Gnade sei mit euch") is False


def test_english_meta_commentary_is_suppressed():
    assert should_suppress_translation_text("I have determined the translation") is True
    assert should_suppress_translation_text("interpreting the sermon") is True
