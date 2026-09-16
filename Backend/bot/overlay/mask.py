"""Metin kalıntısını sil: balon rengini örnekle, yalnızca benzer renge yayıl."""

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None


def clamp_box(box, w, h):
    x1, y1, x2, y2 = [int(round(v)) for v in box]
    x1 = max(0, min(x1, w - 1))
    y1 = max(0, min(y1, h - 1))
    x2 = max(x1 + 1, min(x2, w))
    y2 = max(y1 + 1, min(y2, h))
    return x1, y1, x2, y2


def sample_bg(img, box):
    """Balon zemini: kutunun iç çemberinden medyan (sayfa zemini ve yazı karışmasın)."""
    h, w = img.shape[:2]
    x1, y1, x2, y2 = clamp_box(box, w, h)
    bw, bh = x2 - x1, y2 - y1
    parts = []
    for t in (0.18, 0.28, 0.38):
        ix1 = x1 + int(bw * t)
        iy1 = y1 + int(bh * t)
        ix2 = x2 - int(bw * t)
        iy2 = y2 - int(bh * t)
        if ix2 - ix1 < 4 or iy2 - iy1 < 4:
            continue
        parts.append(img[iy1:iy1 + 2, ix1:ix2].reshape(-1, 3))
        parts.append(img[iy2 - 2:iy2, ix1:ix2].reshape(-1, 3))
        parts.append(img[iy1:iy2, ix1:ix1 + 2].reshape(-1, 3))
        parts.append(img[iy1:iy2, ix2 - 2:ix2].reshape(-1, 3))
    if parts:
        pix = np.concatenate(parts, axis=0)
    else:
        pix = img[y1:y2, x1:x2].reshape(-1, 3)
    if pix.size == 0:
        return np.array([255, 255, 255], dtype=np.uint8)
    return np.median(pix, axis=0).astype(np.uint8)


def auto_text_color(bg):
    r, g, b = [int(v) for v in bg]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    if lum < 145:
        return (255, 255, 255)
    return (22, 22, 22)


def grow_mask(img, box, max_grow=26, thresh=36):
    """Kutunun dikdörtgenini değil, balon zeminini ve üstündeki yazıyı sil.

    Gevşek kutu altıgen/oval dışına taşsa bile sayfa zemini korunur.
    """
    h, w = img.shape[:2]
    x1, y1, x2, y2 = clamp_box(box, w, h)
    bg = sample_bg(img, (x1, y1, x2, y2)).astype(np.uint8)
    lab = img.astype(np.float32)
    bg_f = bg.astype(np.float32).reshape(1, 1, 3)
    dist = np.sqrt(np.sum((lab - bg_f) ** 2, axis=2))
    close = dist <= float(thresh)

    crop_close = close[y1:y2, x1:x2]
    if cv2 is not None:
        near = cv2.dilate(
            crop_close.astype(np.uint8) * 255,
            np.ones((3, 3), dtype=np.uint8),
            iterations=2,
        ) > 0
    else:
        near = crop_close
    crop_text = (~crop_close) & near

    mask = np.zeros((h, w), dtype=np.uint8)
    crop = np.zeros((y2 - y1, x2 - x1), dtype=np.uint8)
    crop[crop_close | crop_text] = 255
    mask[y1:y2, x1:x2] = crop

    kernel = np.ones((3, 3), dtype=np.uint8)
    for _ in range(max(0, int(max_grow))):
        dilated = cv2.dilate(mask, kernel, iterations=1) if cv2 is not None else mask
        border = (dilated > 0) & (mask == 0)
        if not np.any(border):
            break
        accept = border & close
        if not np.any(accept):
            break
        mask[accept] = 255

    # Balon içindeki kutu dışı kalıntı (küçük bağlı bileşenler)
    if cv2 is not None and np.any(mask):
        remnant = (dist > float(thresh)).astype(np.uint8) * 255
        remnant[mask > 0] = 0
        dilated = cv2.dilate(mask, kernel, iterations=3)
        touch = (dilated > 0) & (remnant > 0)
        n, labels = cv2.connectedComponents(remnant)
        max_area = max(80, int((x2 - x1) * (y2 - y1) * 0.35))
        for i in range(1, n):
            comp = labels == i
            if not np.any(comp & touch):
                continue
            if int(np.count_nonzero(comp)) <= max_area:
                mask[comp] = 255
    return mask, bg


def inner_box(mask, pad_ratio=0.11, min_pad=5):
    """Yazının duracağı dikdörtgen: maskenin içine gömülü (altıgen köşelere taşmaz)."""
    if cv2 is None:
        ys, xs = np.where(mask > 0)
        if len(xs) == 0:
            return (0, 0, 1, 1)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())

    dist = cv2.distanceTransform(mask, cv2.DIST_L2, 3)
    ys0, xs0 = np.where(mask > 0)
    if len(xs0) == 0:
        return (0, 0, 1, 1)
    bw = int(xs0.max() - xs0.min() + 1)
    bh = int(ys0.max() - ys0.min() + 1)
    pad = max(min_pad, int(min(bw, bh) * float(pad_ratio)))
    ys, xs = np.where(dist >= pad)
    if len(xs) < 12:
        ys, xs = ys0, xs0
        inset_x = max(2, bw // 12)
        inset_y = max(2, bh // 12)
        return (
            int(xs.min()) + inset_x,
            int(ys.min()) + inset_y,
            int(xs.max()) - inset_x,
            int(ys.max()) - inset_y,
        )
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def erase_mask(img, mask, bg, use_inpaint=False):
    """Balon/panelde düz zemin doldur; karmaşık SFX'te inpaint."""
    out = img.copy()
    if use_inpaint and cv2 is not None:
        return cv2.inpaint(out, mask, 4, cv2.INPAINT_TELEA)
    out[mask > 0] = bg
    return out


def union_masks(masks, shape):
    acc = np.zeros(shape[:2], dtype=np.uint8)
    for m in masks:
        acc = np.maximum(acc, m)
    return acc
