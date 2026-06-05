"""Term candidate extraction for trending analysis.

Extracts candidate (term, term_type) pairs from a single article using:
  1. Title unigrams   → term_type="title_word"
  2. Title bigrams    → term_type="title_bigram"
  3. Excerpt unigrams → term_type="excerpt_word"
"""
from __future__ import annotations

from typing import List, Mapping, Set, Tuple

from imperium_news_pipeline.phase3.trending.text_cleaner import (
    clean_and_tokenise,
    clean_title_tokens,
)


def extract_candidates(
    title: str,
    excerpt: str,
    body_text_clean: str,
    language_code: str,
    stopwords_map: Mapping[str, Set[str]],
    blocked_terms: Set[str],
) -> List[Tuple[str, str]]:
    """Return deduplicated (term, term_type) pairs from one article.

    Deduplication key: (term, term_type) — same term can appear as both
    title_word and title_bigram.
    """
    seen: set[Tuple[str, str]] = set()
    candidates: list[Tuple[str, str]] = []

    def _add(term: str, term_type: str) -> None:
        key = (term, term_type)
        if key not in seen:
            seen.add(key)
            candidates.append(key)

    # 1. Title unigrams
    title_tokens = clean_title_tokens(title, language_code, stopwords_map, blocked_terms)
    for token in title_tokens:
        _add(token, "title_word")

    # 2. Title bigrams — adjacent pairs from cleaned title tokens
    for i in range(len(title_tokens) - 1):
        bigram = f"{title_tokens[i]} {title_tokens[i + 1]}"
        _add(bigram, "title_bigram")

    # 3. Excerpt unigrams
    excerpt_tokens = clean_and_tokenise(
        "", excerpt, "", language_code, stopwords_map, blocked_terms,
    )
    for token in excerpt_tokens:
        _add(token, "excerpt_word")

    return candidates
