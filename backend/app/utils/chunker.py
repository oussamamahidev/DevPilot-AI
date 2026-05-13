import re
from functools import lru_cache
from typing import Any


@lru_cache(maxsize=1)
def _get_tiktoken_encoding() -> Any | None:
    try:
        import tiktoken
    except ImportError:
        return None

    return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    if not text:
        return 0

    encoding = _get_tiktoken_encoding()
    if encoding is not None:
        return len(encoding.encode(text))

    return len(re.findall(r"\S+", text))


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[dict[str, Any]]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than 0")
    if overlap < 0:
        raise ValueError("overlap must be greater than or equal to 0")
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    word_matches = list(re.finditer(r"\S+", text))
    if not word_matches:
        return []

    word_token_counts = [max(count_tokens(match.group(0)), 1) for match in word_matches]
    chunks: list[dict[str, Any]] = []
    start_word = 0

    while start_word < len(word_matches):
        token_total = 0
        end_word = start_word

        while end_word < len(word_matches):
            next_total = token_total + word_token_counts[end_word]
            if end_word > start_word and next_total > chunk_size:
                break
            token_total = next_total
            end_word += 1

        start_char = word_matches[start_word].start()
        end_char = word_matches[end_word - 1].end()
        content = text[start_char:end_char].strip()

        if content:
            chunks.append(
                {
                    "content": content,
                    "chunk_index": len(chunks),
                    "token_count": count_tokens(content),
                    "metadata": {
                        "start_char": start_char,
                        "end_char": end_char,
                    },
                }
            )

        if end_word >= len(word_matches):
            break

        next_start_word = _find_overlap_start(
            start_word=start_word,
            end_word=end_word,
            overlap=overlap,
            word_token_counts=word_token_counts,
        )
        start_word = end_word if next_start_word <= start_word else next_start_word

    return chunks


def _find_overlap_start(
    start_word: int,
    end_word: int,
    overlap: int,
    word_token_counts: list[int],
) -> int:
    if overlap == 0:
        return end_word

    overlap_tokens = 0
    next_start_word = end_word

    while next_start_word > start_word and overlap_tokens < overlap:
        next_start_word -= 1
        overlap_tokens += word_token_counts[next_start_word]

    return next_start_word
