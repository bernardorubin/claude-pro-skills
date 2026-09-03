#!/usr/bin/env python3
"""Put a Slack draft on the macOS clipboard with an HTML flavor attached.

`pbcopy` sets plain-text flavors only, so Slack never sees the markup and falls
back to its own paste conversion, which does not handle `[label](url)`. Copying
the same text out of a browser works because the browser also puts an `HTML`
flavor on the pasteboard. This does that from the terminal.

Converts only the vocabulary write-slack-message is allowed to emit: links,
inline code, fenced code blocks, blockquotes, ordered and unordered lists,
paragraphs. Not a general markdown renderer, and should not become one -- if a
draft needs more than this, the skill's formatting rules are the thing to fix.

Falls back to plain `pbcopy` if osascript is unavailable, so a copy always
happens even when the rich path fails.
"""

from __future__ import annotations

import html
import re
import subprocess
import sys
import tempfile
from pathlib import Path

LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
CODE_SPAN = re.compile(r"`([^`]+)`")


def inline(text: str) -> str:
    """Escape, then apply link and code-span markup outside of code spans."""
    parts, out = CODE_SPAN.split(text), []
    for i, part in enumerate(parts):
        if i % 2:  # odd indexes are the code-span contents
            out.append(f"<code>{html.escape(part)}</code>")
        else:
            out.append(LINK.sub(
                lambda m: f'<a href="{html.escape(m.group(2), quote=True)}">'
                          f"{html.escape(m.group(1))}</a>",
                html.escape(part),
            ))
    return "".join(out)


def to_plain(md: str) -> str:
    """Markdown stripped to what pastes cleanly as PLAIN text into Slack.

    For phone delivery, where the clipboard carries no HTML flavor and
    `[label](url)` would land as literal markup. Links collapse to the bare URL
    (Slack auto-links those), fence markers and blockquote markers go.

    Backticks go too. Verified on iOS Slack 2026-08-24: a plain-text paste does
    NOT convert them, so `foo` arrives with the marks visible. List markers stay
    -- a leading "- " reads fine either way.
    """
    out: list[str] = []
    in_code = False
    for raw in md.splitlines():
        if raw.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            out.append(raw)
            continue
        line = re.sub(r"^(\s*)>\s?", r"\1", raw)
        # Only outside code spans, so `[x](url)` inside backticks stays literal.
        # Odd indexes were code spans: keep the text, drop the marks, and leave
        # the content verbatim (a link written inside one was meant to be literal).
        parts = CODE_SPAN.split(line)
        line = "".join(
            part if i % 2 else LINK.sub(lambda m: m.group(2), part)
            for i, part in enumerate(parts)
        )
        out.append(line)
    return "\n".join(out).strip() + "\n"


def to_html(md: str) -> str:
    out: list[str] = []
    list_tag: str | None = None
    in_code = False
    code: list[str] = []

    def close_list() -> None:
        nonlocal list_tag
        if list_tag:
            out.append(f"</{list_tag}>")
            list_tag = None

    for raw in md.splitlines():
        line = raw.rstrip()

        if line.startswith("```"):
            if in_code:
                out.append("<pre><code>" + html.escape("\n".join(code)) + "</code></pre>")
                code, in_code = [], False
            else:
                close_list()
                in_code = True
            continue
        if in_code:
            code.append(raw)
            continue

        if not line.strip():
            # Deliberately does NOT close an open list. A blank line between
            # items is a "loose" list and is still one list; closing here split
            # it into consecutive <ol>s that each restarted numbering at 1.
            # Whatever actually ends a list (paragraph, blockquote, fence, end
            # of input) closes it in the branches below.
            continue

        if line.startswith(">"):
            close_list()
            out.append(f"<blockquote>{inline(line.lstrip('> '))}</blockquote>")
            continue

        ordered = re.match(r"\d+\.\s+(.*)", line)
        bullet = re.match(r"[-*]\s+(.*)", line)
        if ordered or bullet:
            want = "ol" if ordered else "ul"
            if list_tag != want:
                close_list()
                out.append(f"<{want}>")
                list_tag = want
            out.append(f"<li>{inline((ordered or bullet).group(1))}</li>")
            continue

        close_list()
        out.append(f"<p>{inline(line)}</p>")

    if in_code:  # unterminated fence: keep the content rather than dropping it
        out.append("<pre><code>" + html.escape("\n".join(code)) + "</code></pre>")
    close_list()
    return "".join(out)


def applescript_literal(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", '" & linefeed & "') + '"'


def copy(md: str) -> str:
    """Returns the flavor actually set: 'html+plain' or 'plain'."""
    hexed = to_html(md).encode("utf-8").hex()
    script = (
        "set the clipboard to {«class HTML»:«data HTML"
        + hexed
        + "», string:"
        + applescript_literal(md)
        + "}"
    )
    with tempfile.NamedTemporaryFile("w", suffix=".applescript", delete=False, encoding="utf-8") as f:
        f.write(script)
        path = f.name
    try:
        subprocess.run(["osascript", path], check=True, capture_output=True)
        return "html+plain"
    except (subprocess.CalledProcessError, FileNotFoundError):
        subprocess.run(["pbcopy"], input=md.encode("utf-8"), check=True)
        return "plain"
    finally:
        Path(path).unlink(missing_ok=True)


def selftest() -> None:
    got = to_html("see [HPY-1](https://x.test) and `a<b`\n\n- one\n- two\n\n```\nx=1\n```")
    for expect in (
        '<a href="https://x.test">HPY-1</a>',
        "<code>a&lt;b</code>",
        "<ul><li>one</li><li>two</li></ul>",
        "<pre><code>x=1</code></pre>",
    ):
        assert expect in got, f"missing {expect!r} in {got!r}"
    # a URL inside a code span must not become a link
    assert "<a" not in to_html("`[x](https://y.test)`"), "linked inside code span"

    # A loose list (blank line between items) is ONE list. Splitting it made
    # every item render as "1." in Slack and in the drafts viewer.
    loose = to_html("1. first\n\n2. second")
    assert loose == "<ol><li>first</li><li>second</li></ol>", f"loose list split: {loose!r}"
    assert to_html("- a\n\n- b") == "<ul><li>a</li><li>b</li></ul>", "loose bullets split"
    # ...but a paragraph after a list still ends it
    assert to_html("1. a\n\nafter") == "<ol><li>a</li></ol><p>after</p>", "list not closed by text"

    flat = to_plain("see [HPY-1](https://x.test) now\n\n> quoted\n\n```\nx=1\n```\n- a `tok`")
    assert "https://x.test" in flat and "[HPY-1]" not in flat, f"link not flattened: {flat!r}"
    assert "quoted" in flat and ">" not in flat, f"blockquote marker kept: {flat!r}"
    assert "x=1" in flat and "```" not in flat, f"fence marker kept: {flat!r}"
    assert "`" not in flat, f"backticks kept: {flat!r}"
    assert "tok" in flat, f"code-span text lost: {flat!r}"
    assert "- a " in flat, f"list marker dropped: {flat!r}"
    assert to_plain("`[x](https://y.test)`").strip() == "[x](https://y.test)", "rewrote inside code span"
    print("ok")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--selftest"]:
        selftest()
    elif sys.argv[1:2] == ["--plain"]:
        sys.stdout.write(to_plain(Path(sys.argv[2]).read_text(encoding="utf-8")))
    else:
        print(copy(Path(sys.argv[1]).read_text(encoding="utf-8")))
