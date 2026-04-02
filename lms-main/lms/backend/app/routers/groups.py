from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Group, User
from app.schemas.schemas import GroupCreate, GroupUpdate, GroupOut, GroupDetail
from app.auth import require_admin, get_current_user

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.get("/", response_model=List[GroupOut])
def list_groups(
    course_id: int = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Group)
    if course_id:
        q = q.filter(Group.course_id == course_id)
    return q.all()


@router.post("/", response_model=GroupOut)
def create_group(data: GroupCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    group = Group(**data.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.get("/{group_id}", response_model=GroupDetail)
def get_group(group_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Группа не найдена")
    return group


@router.put("/{group_id}", response_model=GroupOut)
def update_group(group_id: int, data: GroupUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Группа не найдена")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(group, k, v)
    db.commit()
    db.refresh(group)
    return group


@router.delete("/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Группа не найдена")
    db.delete(group)
    db.commit()
    return {"ok": True}
