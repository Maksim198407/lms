from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Theme, User
from app.schemas.schemas import ThemeCreate, ThemeUpdate, ThemeOut
from app.auth import require_admin, get_current_user

router = APIRouter(prefix="/api/themes", tags=["themes"])


@router.get("/", response_model=List[ThemeOut])
def list_themes(course_id: int = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Theme)
    if course_id:
        q = q.filter(Theme.course_id == course_id)
    return q.order_by(Theme.order).all()


@router.post("/", response_model=ThemeOut)
def create_theme(data: ThemeCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    theme = Theme(**data.model_dump())
    db.add(theme)
    db.commit()
    db.refresh(theme)
    return theme


@router.get("/{theme_id}", response_model=ThemeOut)
def get_theme(theme_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    theme = db.query(Theme).filter(Theme.id == theme_id).first()
    if not theme:
        raise HTTPException(404, "Тема не найдена")
    return theme


@router.put("/{theme_id}", response_model=ThemeOut)
def update_theme(theme_id: int, data: ThemeUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    theme = db.query(Theme).filter(Theme.id == theme_id).first()
    if not theme:
        raise HTTPException(404, "Тема не найдена")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(theme, k, v)
    db.commit()
    db.refresh(theme)
    return theme


@router.delete("/{theme_id}")
def delete_theme(theme_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    theme = db.query(Theme).filter(Theme.id == theme_id).first()
    if not theme:
        raise HTTPException(404, "Тема не найдена")
    db.delete(theme)
    db.commit()
    return {"ok": True}
