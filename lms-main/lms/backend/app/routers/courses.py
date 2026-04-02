from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Course, User
from app.schemas.schemas import CourseCreate, CourseUpdate, CourseOut
from app.auth import require_admin, get_current_user

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("/", response_model=List[CourseOut])
def list_courses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role.value == "ADMIN":
        return db.query(Course).all()
    # student sees only courses of their group
    if user.group_id:
        from app.models.models import Group
        group = db.query(Group).filter(Group.id == user.group_id).first()
        if group:
            return [group.course]
    return []


@router.post("/", response_model=CourseOut)
def create_course(data: CourseCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    course = Course(**data.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(404, "Курс не найден")
    return course


@router.put("/{course_id}", response_model=CourseOut)
def update_course(course_id: int, data: CourseUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(404, "Курс не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(course, k, v)
    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(404, "Курс не найден")
    db.delete(course)
    db.commit()
    return {"ok": True}
