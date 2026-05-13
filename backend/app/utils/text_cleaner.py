import re


_CODE_FENCE_RE = re.compile(r"(^[ \t]*```.*?^[ \t]*```[ \t]*$)", re.MULTILINE | re.DOTALL)
_PAGE_ARTIFACT_PATTERNS = (
    re.compile(r"^\s*page\s+\d+\s*$", re.IGNORECASE),
    re.compile(r"^\s*(?:page\s+)?\d+\s*(?:/|of)\s*\d+\s*$", re.IGNORECASE),
    re.compile(r"^\s*[-_=]{3,}\s*$"),
)


def clean_text(text: str) -> str:
    normalized = (
        text.replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("\f", "\n\n")
        .replace("\u00a0", " ")
        .replace("\x00", "")
    )

    cleaned_parts: list[str] = []
    for is_code_block, part in _split_code_fences(normalized):
        if is_code_block:
            cleaned_parts.append(_clean_code_block(part))
        else:
            cleaned_parts.append(_clean_plain_text(part))

    cleaned = "".join(cleaned_parts)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _split_code_fences(text: str) -> list[tuple[bool, str]]:
    parts: list[tuple[bool, str]] = []
    cursor = 0
    for match in _CODE_FENCE_RE.finditer(text):
        if match.start() > cursor:
            parts.append((False, text[cursor : match.start()]))
        parts.append((True, match.group(0)))
        cursor = match.end()

    if cursor < len(text):
        parts.append((False, text[cursor:]))

    return parts


def _clean_plain_text(text: str) -> str:
    cleaned_lines: list[str] = []
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if _is_page_artifact(line):
            continue
        line = re.sub(r"[ \t]+", " ", line)
        cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def _clean_code_block(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.split("\n"))


def _is_page_artifact(line: str) -> bool:
    if not line:
        return False
    return any(pattern.match(line) for pattern in _PAGE_ARTIFACT_PATTERNS)
