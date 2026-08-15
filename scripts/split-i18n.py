#!/usr/bin/env python3
"""
Mechanical split of the legacy src/lib/i18n.tsx monolith into per-language
locale modules under src/lib/i18n/locales/. The dictionary contents are moved
byte-for-byte; the module scaffolding (types/fallback/context/index) is
authored by hand and untouched by this script. Run once, then verify with
`bun tsc -b --noEmit`.
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "lib")
OLD = os.path.join(SRC, "i18n.tsx")
TR_EXTRA = os.path.join(SRC, "i18n-tr-extra.ts")
OUT_DIR = os.path.join(SRC, "i18n", "locales")

PARTIAL_NAMES = [
    "es", "fr", "de", "it", "pt", "ar", "ru", "ja", "ko",
    "zhCN", "zhTW", "hi", "id", "nl", "pl", "uk", "sv", "no",
    "da", "fi", "el", "cs", "ro", "vi", "th",
]

def read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def extract_body(text: str, start_marker: str, end_line: str) -> str:
    """Return the object-literal body (without braces) for a top-level
    `const X = {` block ending at a `};` line, plus that closing line."""
    lines = text.splitlines()
    start = None
    for i, line in enumerate(lines):
        if start_marker in line and "= {" in line:
            start = i
            break
    if start is None:
        raise RuntimeError(f"marker not found: {start_marker}")
    # find the matching close: first line that is exactly "};"
    end = None
    for j in range(start + 1, len(lines)):
        if lines[j].strip() == end_line:
            end = j
            break
    if end is None:
        raise RuntimeError(f"close not found for: {start_marker}")
    return "\n".join(lines[start + 1 : end])

def main() -> None:
    text = read(OLD)
    os.makedirs(OUT_DIR, exist_ok=True)

    # --- English (full dict) ---
    en_body = extract_body(text, "const en", "};")
    write(
        os.path.join(OUT_DIR, "en.ts"),
        "// English is the source of truth for every translation key (TKey).\n"
        "// New keys are added here first; other locales only override what they\n"
        "// translate, everything else falls back to English automatically.\n\n"
        f"export const en = {{\n{en_body}\n}};\n",
    )

    # --- Turkish (partial + legacy trExtra merged) ---
    tr_body = extract_body(text, "const tr", "};")
    tr_lines = tr_body.splitlines()
    tr_lines = [ln for ln in tr_lines if "(trExtra as Partial" not in ln]
    tr_extra_text = read(TR_EXTRA)
    m = re.search(r"export const trExtra = \{(.*?)\};", tr_extra_text, re.S)
    if not m:
        raise RuntimeError("trExtra body not found")
    tr_extra_body = m.group(1).strip()
    # Inject the trExtra entries at the top of the object.
    merged = tr_extra_body + "\n" + "\n".join(tr_lines).lstrip("\n")
    write(
        os.path.join(OUT_DIR, "tr.ts"),
        "import type { PartialDict } from \"../types\";\n\n"
        "// Turkish translations (partial — missing keys fall back to English).\n"
        f"export const tr: PartialDict = {{\n{merged}\n}};\n",
    )

    # --- All other partials ---
    for name in PARTIAL_NAMES:
        body = extract_body(text, f"const {name}", "};")
        write(
            os.path.join(OUT_DIR, f"{name}.ts"),
            "import type { PartialDict } from \"../types\";\n\n"
            f"// {name} translations (partial — missing keys fall back to English).\n"
            f"export const {name}: PartialDict = {{\n{body}\n}};\n",
        )

    # --- Remove the legacy monolith files ---
    for legacy in (OLD, TR_EXTRA):
        if os.path.exists(legacy):
            os.remove(legacy)

    print("split complete:", sorted(os.listdir(OUT_DIR)))

if __name__ == "__main__":
    main()
