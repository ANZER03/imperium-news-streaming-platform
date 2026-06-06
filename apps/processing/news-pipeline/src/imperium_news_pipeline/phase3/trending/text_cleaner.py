"""Text cleaning for trending term extraction.

Cleans and tokenises article text (title + excerpt + body_text_clean),
removing HTML, URLs, emails, punctuation, short/long tokens, numbers-only
tokens, language-specific stopwords, and global blocked terms.
"""
from __future__ import annotations

import re
from typing import List, Mapping, Set


# Pre-compiled regexes (compiled once at import time)
_RE_HTML = re.compile(r"<[^>]+>")
_RE_URL = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
_RE_EMAIL = re.compile(r"\S+@\S+\.\S+")
_RE_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)
_RE_MULTI_SPACE = re.compile(r"\s+")
_RE_NUMBERS_ONLY = re.compile(r"^\d+$")

MIN_TOKEN_LEN = 3
MAX_TOKEN_LEN = 30


def clean_and_tokenise(
    title: str,
    excerpt: str,
    body_text_clean: str,
    language_code: str,
    stopwords_map: Mapping[str, Set[str]],
    blocked_terms: Set[str],
) -> List[str]:
    """Return a deduplicated list of cleaned tokens from the article text.

    The function concatenates title + excerpt + body_text_clean, then applies
    the full cleaning pipeline described in the PRD.
    """
    parts = [
        title or "",
        excerpt or "",
        body_text_clean or "",
    ]
    text = " ".join(parts)

    if not text.strip():
        return []

    # 1. Remove HTML tags
    text = _RE_HTML.sub(" ", text)
    # 2. Lowercase
    text = text.lower()
    # 3. Remove URLs
    text = _RE_URL.sub(" ", text)
    # 4. Remove emails
    text = _RE_EMAIL.sub(" ", text)
    # 5. Replace punctuation with spaces
    text = _RE_PUNCT.sub(" ", text)
    # 6. Collapse whitespace
    text = _RE_MULTI_SPACE.sub(" ", text).strip()

    if not text:
        return []

    # Resolve language-specific stopwords
    lang = (language_code or "").strip().lower()
    lang_stopwords = stopwords_map.get(lang, stopwords_map.get("unknown", set()))

    tokens: list[str] = []
    for word in text.split():
        # 7. Remove words shorter than 3 chars
        if len(word) < MIN_TOKEN_LEN:
            continue
        # 8. Remove very long words
        if len(word) > MAX_TOKEN_LEN:
            continue
        # 9. Remove numbers-only tokens
        if _RE_NUMBERS_ONLY.match(word):
            continue
        # 10. Remove language-specific stopwords
        if word in lang_stopwords:
            continue
        # 11. Remove global blocked terms
        if word in blocked_terms:
            continue
        tokens.append(word)

    return tokens


def clean_title_tokens(
    title: str,
    language_code: str,
    stopwords_map: Mapping[str, Set[str]],
    blocked_terms: Set[str],
) -> List[str]:
    """Return cleaned tokens from title only (used for bigram extraction)."""
    return clean_and_tokenise(title, "", "", language_code, stopwords_map, blocked_terms)
