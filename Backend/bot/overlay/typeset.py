"""Türkçe balon dizgisi: punto araması, satır kırma, hizalama, harf aralığı."""

from PIL import ImageDraw

from .fonts import load_font


def _width(text, font, tracking):
    if not text:
        return 0
    base = font.getlength(text)
    if tracking <= 0 or len(text) < 2:
        return base
    return base + tracking * font.size * (len(text) - 1)


def wrap_text(text, font, max_width, tracking=0):
    out = []
    for para in (text or "").split("\n"):
        para = " ".join(para.split())
        if not para:
            continue
        if _width(para, font, tracking) <= max_width:
            out.append(para)
            continue
        words = para.split(" ")
        cur = ""
        for word in words:
            trial = word if not cur else f"{cur} {word}"
            if _width(trial, font, tracking) <= max_width:
                cur = trial
                continue
            if cur:
                out.append(cur)
            if _width(word, font, tracking) <= max_width:
                cur = word
                continue
            chunk = ""
            for ch in word:
                t2 = chunk + ch
                if chunk and _width(t2, font, tracking) > max_width:
                    out.append(chunk)
                    chunk = ch
                else:
                    chunk = t2
            cur = chunk
        if cur:
            out.append(cur)
    return out or [""]


def fit_text(text, box, font_path, min_size, max_size, line_spacing, tracking=0, max_lines=None):
    x1, y1, x2, y2 = box
    max_w = max(8, x2 - x1)
    max_h = max(8, y2 - y1)
    lo, hi = int(min_size), int(max_size)
    best = None
    while lo <= hi:
        mid = (lo + hi) // 2
        font = load_font(font_path, mid)
        lines = wrap_text(text, font, max_w, tracking)
        line_h = max(1, int(round(mid * line_spacing)))
        total_h = line_h * len(lines)
        widest = max(_width(line, font, tracking) for line in lines)
        if total_h <= max_h and widest <= max_w + 0.5:
            if max_lines is None or len(lines) <= max_lines:
                best = (mid, lines, font)
                lo = mid + 1
                continue
        hi = mid - 1
    if best:
        return best
    font = load_font(font_path, int(min_size))
    return int(min_size), wrap_text(text, font, max_w, tracking), font


def _draw_tracked(draw, text, xy, font, fill, stroke_w, stroke_fill, tracking):
    x, y = xy
    gap = tracking * font.size
    for i, ch in enumerate(text):
        draw.text(
            (x, y),
            ch,
            font=font,
            fill=fill,
            stroke_width=stroke_w,
            stroke_fill=stroke_fill,
        )
        x += font.getlength(ch) + (gap if i < len(text) - 1 else 0)


def draw_block(
    image,
    text,
    box,
    font_path,
    fill,
    min_size,
    max_size,
    line_spacing,
    tracking=0,
    stroke_ratio=0.0,
    stroke_fill=None,
    max_lines=None,
):
    size, lines, font = fit_text(
        text, box, font_path, min_size, max_size, line_spacing, tracking, max_lines=max_lines
    )
    x1, y1, x2, y2 = box
    line_h = max(1, int(round(size * line_spacing)))
    total_h = line_h * len(lines)
    y = y1 + max(0, (y2 - y1 - total_h) / 2)
    cx = (x1 + x2) / 2
    stroke_w = int(round(size * float(stroke_ratio))) if stroke_ratio else 0
    if stroke_fill is None:
        stroke_fill = (0, 0, 0) if fill[0] > 140 else (255, 255, 255)
    draw = ImageDraw.Draw(image)
    for line in lines:
        w = _width(line, font, tracking)
        x = cx - w / 2
        if tracking > 0 and len(line) > 1:
            _draw_tracked(draw, line, (x, y), font, fill, stroke_w, stroke_fill, tracking)
        else:
            draw.text(
                (x, y),
                line,
                font=font,
                fill=fill,
                stroke_width=stroke_w,
                stroke_fill=stroke_fill,
            )
        y += line_h
    return size, lines
