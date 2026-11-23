import nh3

ALLOWED_NOVEL_TAGS = {
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "blockquote",
    "hr",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "span",
    "div",
    "sub",
    "sup",
}

CLEAN_CONTENT_TAGS = {
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "noscript",
}


def sanitize_novel_html(raw_html: str) -> str:
    """
    Roman bölüm HTML içeriğini XSS saldırılarına karşı temizler;
    yalnızca güvenli biçimlendirme etiketlerini ve özniteliksiz yapıyı korur.
    """
    if not raw_html:
        return ""
    return nh3.clean(
        str(raw_html),
        tags=ALLOWED_NOVEL_TAGS,
        attributes={},
        clean_content_tags=CLEAN_CONTENT_TAGS,
        strip_comments=True,
    )
