from datetime import datetime
from typing import Dict, List, Optional, Set
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import asc, desc, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from database import get_db
from routers.auth import get_current_user, get_optional_user
import models
from utils.chapter_title import chapter_display_label, format_chapter_number

router = APIRouter(
    prefix="/comments",
    tags=["Comments"]
)


# --- ŞEMALAR ---
class CommentCreate(BaseModel):
    content: str
    novel_chapter_id: Optional[int] = None
    webtoon_episode_id: Optional[int] = None
    webtoon_id: Optional[int] = None
    novel_id: Optional[int] = None
    parent_id: Optional[int] = None
    is_spoiler: bool = False


class CommentUpdate(BaseModel):
    content: Optional[str] = None
    is_spoiler: Optional[bool] = None


class CommentReportIn(BaseModel):
    reason: str


def _seri_bilgisi(c):
    """Yorumun ait olduğu seri + bölüm/sayfa bilgisi ve okuma sayfası linki."""
    if c.novel_chapter:
        novel = c.novel_chapter.novel
        return {
            "seri_type": "novel",
            "seri_title": novel.title if novel else "Silinmiş Seri",
            "bolum_title": chapter_display_label(c.novel_chapter.title, c.novel_chapter.chapter_number),
            "link": f"/novel/{novel.slug}/bolum/{format_chapter_number(c.novel_chapter.chapter_number)}" if novel else None,
        }
    if c.webtoon_episode:
        w = c.webtoon_episode.webtoon
        return {
            "seri_type": "webtoon",
            "seri_title": w.title if w else "Silinmiş Seri",
            "bolum_title": chapter_display_label(c.webtoon_episode.title, c.webtoon_episode.episode_number),
            "link": f"/webtoon/{w.slug or w.id}/bolum/{c.webtoon_episode.id}" if w else None,
        }
    if getattr(c, "novel", None):
        n = c.novel
        return {
            "seri_type": "novel",
            "seri_title": n.title if n else "Silinmiş Seri",
            "bolum_title": "Seri Sayfası",
            "link": f"/novel/{n.slug}" if n else None,
        }
    if getattr(c, "webtoon", None):
        w = c.webtoon
        return {
            "seri_type": "webtoon",
            "seri_title": w.title if w else "Silinmiş Seri",
            "bolum_title": "Seri Sayfası",
            "link": f"/webtoon/{w.slug or w.id}" if w else None,
        }
    return {"seri_type": None, "seri_title": None, "bolum_title": None, "link": None}


_COMMENT_LOAD_OPTIONS = [
    joinedload(models.Comment.user),
    joinedload(models.Comment.novel_chapter).joinedload(models.NovelChapter.novel),
    joinedload(models.Comment.webtoon_episode).joinedload(models.WebtoonEpisode.webtoon),
    joinedload(models.Comment.webtoon),
    joinedload(models.Comment.novel),
]


def _load_engagement_maps(
    db: Session,
    comment_ids: List[int],
    current_user: Optional[models.User],
) -> tuple[Dict[int, int], Set[int], Set[int]]:
    if not comment_ids:
        return {}, set(), set()

    likes_map: Dict[int, int] = {}
    like_rows = (
        db.query(models.CommentLike.comment_id, func.count(models.CommentLike.id))
        .filter(models.CommentLike.comment_id.in_(comment_ids))
        .group_by(models.CommentLike.comment_id)
        .all()
    )
    for cid, cnt in like_rows:
        likes_map[int(cid)] = int(cnt or 0)

    liked_ids: Set[int] = set()
    reported_ids: Set[int] = set()
    if current_user is not None:
        user_likes = (
            db.query(models.CommentLike.comment_id)
            .filter(
                models.CommentLike.user_id == current_user.id,
                models.CommentLike.comment_id.in_(comment_ids),
            )
            .all()
        )
        liked_ids = {int(r[0]) for r in user_likes}

        user_reports = (
            db.query(models.CommentReport.comment_id)
            .filter(
                models.CommentReport.user_id == current_user.id,
                models.CommentReport.comment_id.in_(comment_ids),
                models.CommentReport.status == "open",
            )
            .all()
        )
        reported_ids = {int(r[0]) for r in user_reports}

    return likes_map, liked_ids, reported_ids


def _format_comment_item(
    c: models.Comment,
    likes_map: Dict[int, int],
    liked_ids: Set[int],
    reported_ids: Set[int],
    replies: Optional[List[dict]] = None,
) -> dict:
    avatar = c.user.profile_image if c.user else None
    return {
        "id": c.id,
        "content": c.content,
        "created_at": str(c.created_at),
        "updated_at": str(c.updated_at) if c.updated_at else None,
        "is_spoiler": bool(getattr(c, "is_spoiler", False)),
        "user_id": c.user_id,
        "user_username": c.user.username if c.user else "Silinmiş Kullanıcı",
        "user_role": c.user.role if c.user else "user",
        "user_image": avatar,
        "user_profile_image": avatar,
        "parent_id": c.parent_id,
        "likes_count": likes_map.get(c.id, 0),
        "liked_by_me": c.id in liked_ids,
        "is_reported_by_me": c.id in reported_ids,
        "replies": replies if replies is not None else [],
    }


def _comment_to_dict(c: models.Comment) -> dict:
    return _format_comment_item(c, {}, set(), set(), [])


def _fetch_paginated_comments(
    db: Session,
    response: Response,
    target_column,
    target_id: int,
    *,
    limit: int,
    offset: int,
    sort: str,
    current_user: Optional[models.User],
) -> List[dict]:
    base_top_q = db.query(models.Comment).filter(
        target_column == target_id,
        models.Comment.parent_id.is_(None),
    )
    total_top = base_top_q.count()
    response.headers["X-Total-Count"] = str(total_top)

    if total_top == 0:
        return []

    clean_sort = (sort or "newest").strip().lower()
    if clean_sort == "oldest":
        ordered_q = base_top_q.order_by(asc(models.Comment.created_at), asc(models.Comment.id))
    elif clean_sort == "top":
        like_subq = (
            db.query(
                models.CommentLike.comment_id.label("comment_id"),
                func.count(models.CommentLike.id).label("likes_cnt"),
            )
            .group_by(models.CommentLike.comment_id)
            .subquery()
        )
        ordered_q = base_top_q.outerjoin(
            like_subq, like_subq.c.comment_id == models.Comment.id
        ).order_by(
            desc(func.coalesce(like_subq.c.likes_cnt, 0)),
            desc(models.Comment.created_at),
            desc(models.Comment.id),
        )
    else:
        ordered_q = base_top_q.order_by(desc(models.Comment.created_at), desc(models.Comment.id))

    top_comments = ordered_q.options(joinedload(models.Comment.user)).offset(offset).limit(limit).all()
    if not top_comments:
        return []

    # Collect all nested replies for the current page in batched BFS rounds
    descendants_by_id: Dict[int, models.Comment] = {}
    children_map: Dict[int, List[models.Comment]] = {}
    frontier = [int(c.id) for c in top_comments]
    seen_ids = set(frontier)
    depth = 0
    while frontier and depth < 10:
        depth += 1
        batch_replies = (
            db.query(models.Comment)
            .options(joinedload(models.Comment.user))
            .filter(models.Comment.parent_id.in_(frontier))
            .order_by(asc(models.Comment.created_at), asc(models.Comment.id))
            .all()
        )
        next_frontier = []
        for r in batch_replies:
            rid = int(r.id)
            if rid in seen_ids:
                continue
            seen_ids.add(rid)
            descendants_by_id[rid] = r
            children_map.setdefault(int(r.parent_id), []).append(r)
            next_frontier.append(rid)
        frontier = next_frontier

    all_ids = [int(c.id) for c in top_comments] + list(descendants_by_id.keys())
    likes_map, liked_ids, reported_ids = _load_engagement_maps(db, all_ids, current_user)

    def _build_node(c: models.Comment) -> dict:
        child_objs = children_map.get(int(c.id), [])
        child_dicts = [_build_node(ch) for ch in child_objs]
        return _format_comment_item(c, likes_map, liked_ids, reported_ids, child_dicts)

    return [_build_node(tc) for tc in top_comments]


# 1. YORUM EKLE (POST /comments/)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_comment(
    comment: CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    cleaned_content = (comment.content or "").strip()
    if not cleaned_content:
        raise HTTPException(status_code=400, detail="Yorum içeriği boş olamaz.")
    if len(cleaned_content) > 2000:
        raise HTTPException(status_code=400, detail="Yorum en fazla 2000 karakter olabilir.")

    novel_chapter_id = comment.novel_chapter_id
    webtoon_episode_id = comment.webtoon_episode_id
    webtoon_id = comment.webtoon_id
    novel_id = comment.novel_id

    if comment.parent_id is not None:
        parent = db.query(models.Comment).filter(models.Comment.id == comment.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Yanıt verilen yorum bulunamadı.")
        novel_chapter_id = parent.novel_chapter_id
        webtoon_episode_id = parent.webtoon_episode_id
        webtoon_id = parent.webtoon_id
        novel_id = parent.novel_id
    else:
        provided = [
            x for x in (novel_chapter_id, webtoon_episode_id, webtoon_id, novel_id)
            if x is not None
        ]
        if len(provided) != 1:
            raise HTTPException(
                status_code=400,
                detail="Yorum için tam olarak bir hedef (bölüm veya seri) belirtilmelidir.",
            )
        if webtoon_episode_id is not None:
            if not db.query(models.WebtoonEpisode.id).filter(models.WebtoonEpisode.id == webtoon_episode_id).first():
                raise HTTPException(status_code=404, detail="Yorum yapılan webtoon bölümü bulunamadı.")
        elif novel_chapter_id is not None:
            if not db.query(models.NovelChapter.id).filter(models.NovelChapter.id == novel_chapter_id).first():
                raise HTTPException(status_code=404, detail="Yorum yapılan roman bölümü bulunamadı.")
        elif webtoon_id is not None:
            if not db.query(models.Webtoon.id).filter(models.Webtoon.id == webtoon_id).first():
                raise HTTPException(status_code=404, detail="Yorum yapılan webtoon serisi bulunamadı.")
        elif novel_id is not None:
            if not db.query(models.Novel.id).filter(models.Novel.id == novel_id).first():
                raise HTTPException(status_code=404, detail="Yorum yapılan roman serisi bulunamadı.")

    new_comment = models.Comment(
        content=cleaned_content,
        user_id=current_user.id,
        novel_chapter_id=novel_chapter_id,
        webtoon_episode_id=webtoon_episode_id,
        webtoon_id=webtoon_id,
        novel_id=novel_id,
        parent_id=comment.parent_id,
        is_spoiler=bool(comment.is_spoiler),
    )

    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    if comment.parent_id is not None:
        parent = (
            db.query(models.Comment)
            .options(*_COMMENT_LOAD_OPTIONS)
            .filter(models.Comment.id == comment.parent_id)
            .first()
        )
        if parent and parent.user_id != current_user.id:
            from routers.notifications import create_notification

            seri = _seri_bilgisi(parent)
            preview = cleaned_content[:117] + "..." if len(cleaned_content) > 120 else cleaned_content
            base_link = seri.get("link") or ""
            deep_link = f"{base_link}#comment-{new_comment.id}" if base_link else None
            create_notification(
                db,
                user_id=parent.user_id,
                type_="reply",
                title=f"{current_user.username} yorumuna yanıt verdi",
                message=preview,
                link=deep_link,
            )
            db.commit()

    return {"message": "Yorum başarıyla eklendi", "id": new_comment.id}


# 2. SERİ SAYFASI YORUMLARI
@router.get("/series/webtoon/{webtoon_id}")
def get_series_webtoon_comments(
    webtoon_id: int,
    response: Response,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("newest"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    return _fetch_paginated_comments(
        db, response, models.Comment.webtoon_id, webtoon_id,
        limit=limit, offset=offset, sort=sort, current_user=current_user,
    )


@router.get("/series/novel/{novel_id}")
def get_series_novel_comments(
    novel_id: int,
    response: Response,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("newest"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    return _fetch_paginated_comments(
        db, response, models.Comment.novel_id, novel_id,
        limit=limit, offset=offset, sort=sort, current_user=current_user,
    )


# 3. BÖLÜM YORUMLARI GETİR (Webtoon & Novel)
@router.get("/webtoon/{episode_id}")
def get_webtoon_comments(
    episode_id: int,
    response: Response,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("newest"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    return _fetch_paginated_comments(
        db, response, models.Comment.webtoon_episode_id, episode_id,
        limit=limit, offset=offset, sort=sort, current_user=current_user,
    )


@router.get("/novel/{chapter_id}")
def get_novel_comments(
    chapter_id: int,
    response: Response,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("newest"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    return _fetch_paginated_comments(
        db, response, models.Comment.novel_chapter_id, chapter_id,
        limit=limit, offset=offset, sort=sort, current_user=current_user,
    )


# 4. BİR KULLANICININ TÜM YORUMLARI
@router.get("/kullanici/{username}")
def get_user_comments(username: str, limit: int = 100, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    comments = (
        db.query(models.Comment)
        .options(*_COMMENT_LOAD_OPTIONS)
        .filter(models.Comment.user_id == user.id)
        .order_by(desc(models.Comment.created_at))
        .limit(min(limit, 200))
        .all()
    )

    return [{**_comment_to_dict(c), **_seri_bilgisi(c)} for c in comments]


# 5. YORUM DÜZENLE (Yalnızca sahibi)
@router.put("/{comment_id}")
def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    comment = (
        db.query(models.Comment)
        .options(joinedload(models.Comment.user))
        .filter(models.Comment.id == comment_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Yorum bulunamadı.")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Yalnızca kendi yorumunuzu düzenleyebilirsiniz.")

    if payload.content is not None:
        cleaned = payload.content.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Yorum içeriği boş olamaz.")
        if len(cleaned) > 2000:
            raise HTTPException(status_code=400, detail="Yorum en fazla 2000 karakter olabilir.")
        comment.content = cleaned

    if payload.is_spoiler is not None:
        comment.is_spoiler = bool(payload.is_spoiler)

    comment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(comment)

    likes_map, liked_ids, reported_ids = _load_engagement_maps(db, [comment.id], current_user)
    return _format_comment_item(comment, likes_map, liked_ids, reported_ids, [])


# 6. YORUM BEĞENİ TOGGLE
@router.post("/{comment_id}/like")
def toggle_comment_like(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not db.query(models.Comment.id).filter(models.Comment.id == comment_id).first():
        raise HTTPException(status_code=404, detail="Yorum bulunamadı.")

    existing = (
        db.query(models.CommentLike)
        .filter(
            models.CommentLike.comment_id == comment_id,
            models.CommentLike.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        liked = False
    else:
        try:
            db.add(models.CommentLike(comment_id=comment_id, user_id=current_user.id))
            db.commit()
        except IntegrityError:
            db.rollback()
        liked = True

    likes_count = (
        db.query(func.count(models.CommentLike.id))
        .filter(models.CommentLike.comment_id == comment_id)
        .scalar()
        or 0
    )
    return {"liked": liked, "likes_count": int(likes_count)}


# 7. YORUM ŞİKAYET ET (REPORT UPSERT)
@router.post("/{comment_id}/report")
def report_comment(
    comment_id: int,
    payload: CommentReportIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not db.query(models.Comment.id).filter(models.Comment.id == comment_id).first():
        raise HTTPException(status_code=404, detail="Yorum bulunamadı.")

    clean_reason = (payload.reason or "").strip()
    if not clean_reason:
        raise HTTPException(status_code=400, detail="Şikayet nedeni belirtilmelidir.")
    clean_reason = clean_reason[:200]

    existing = (
        db.query(models.CommentReport)
        .filter(
            models.CommentReport.comment_id == comment_id,
            models.CommentReport.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        existing.reason = clean_reason
        existing.status = "open"
        existing.created_at = datetime.utcnow()
    else:
        db.add(
            models.CommentReport(
                comment_id=comment_id,
                user_id=current_user.id,
                reason=clean_reason,
                status="open",
            )
        )
    db.commit()
    return {"reported": True}


def delete_comment_tree(db: Session, root_comment: models.Comment) -> None:
    """Alt yanıtları ve beğeni/şikayet kayıtlarını güvenli sırada temizler."""
    levels: List[List[int]] = [[int(root_comment.id)]]
    seen = {int(root_comment.id)}
    while True:
        parents = levels[-1]
        child_rows = (
            db.query(models.Comment.id)
            .filter(models.Comment.parent_id.in_(parents))
            .all()
        )
        children = [int(r[0]) for r in child_rows if int(r[0]) not in seen]
        if not children:
            break
        seen.update(children)
        levels.append(children)

    all_ids = list(seen)
    db.query(models.CommentLike).filter(models.CommentLike.comment_id.in_(all_ids)).delete(synchronize_session=False)
    db.query(models.CommentReport).filter(models.CommentReport.comment_id.in_(all_ids)).delete(synchronize_session=False)
    for lvl_ids in reversed(levels):
        db.query(models.Comment).filter(models.Comment.id.in_(lvl_ids)).delete(synchronize_session=False)


# 8. YORUM SİL (Yorum sahibi veya Admin/Editor)
@router.delete("/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Yorum bulunamadı")

    is_staff = current_user.role in ["admin", "editor"]
    is_owner = comment.user_id == current_user.id
    if not (is_staff or is_owner):
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok.")

    delete_comment_tree(db, comment)
    db.commit()
    return {"message": "Yorum ve yanıtları silindi"}