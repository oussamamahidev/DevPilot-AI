import pytest

from app.utils import chunker
from app.utils.text_cleaner import clean_text


def test_clean_text_removes_bad_whitespace_and_page_artifacts() -> None:
    raw_text = """
    # Heading


    Page 1
    This   sentence     has    bad spacing.
    2 / 10

    ```python
    def example():
        return  "spacing inside code is preserved"
    ```
    """

    cleaned = clean_text(raw_text)

    assert "# Heading" in cleaned
    assert "This sentence has bad spacing." in cleaned
    assert "Page 1" not in cleaned
    assert "2 / 10" not in cleaned
    assert "\n\n\n" not in cleaned
    assert 'return  "spacing inside code is preserved"' in cleaned


def test_chunk_text_returns_overlapping_chunks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(chunker, "_get_tiktoken_encoding", lambda: None)
    text = " ".join(f"word{i}" for i in range(16))

    chunks = chunker.chunk_text(text, chunk_size=6, overlap=2)

    assert len(chunks) == 4
    assert chunks[0]["chunk_index"] == 0
    assert chunks[1]["chunk_index"] == 1
    assert chunks[0]["content"].split()[-2:] == chunks[1]["content"].split()[:2]
    assert chunks[1]["content"].split()[-2:] == chunks[2]["content"].split()[:2]
    assert chunks[0]["metadata"]["start_char"] == 0
    assert chunks[0]["metadata"]["end_char"] > chunks[0]["metadata"]["start_char"]
