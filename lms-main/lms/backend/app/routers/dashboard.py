import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import io
import openpyxl

from app.database import get_db
from app.models.models import (
    User, Group, Assignment, Submission, TestAttempt, RoleEnum,
    SubmissionStatusEnum, Notification,
)
from app.schemas.schemas import (
    StudentDashboard, GroupStats, UserOut, SubmissionOut, TestAttemptOut,
    GroupOut, NotificationOut,
)
from app.auth import require_admin, get_current_user
from jose import jwt
from app.config import settings

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/student/{student_id}", response_model=StudentDashboard)
def student_dashboard(student_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    student = db.query(User).filter(User.id == student_id, User.role == RoleEnum.STUDENT).first()
    if not student:
        raise HTTPException(404, "Студент не найден")
    subs = db.query(Submission).filter(Submission.student_id == student_id).all()
    attempts = db.query(TestAttempt).filter(TestAttempt.student_id == student_id).all()
    return StudentDashboard(student=student, scores=subs, test_scores=attempts)


@router.get("/group/{group_id}", response_model=GroupStats)
def group_stats(group_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Группа не найдена")

    assignments = db.query(Assignment).filter(Assignment.group_id == group_id).all()
    total = len(assignments)

    # Average score from submissions + test attempts
    sub_avg = db.query(func.avg(Submission.score)).join(Assignment).filter(
        Assignment.group_id == group_id,
        Submission.score.isnot(None),
    ).scalar() or 0

    test_avg = db.query(func.avg(TestAttempt.score)).join(
        TestAttempt.test
    ).join(Assignment).filter(
        Assignment.group_id == group_id,
        TestAttempt.score.isnot(None),
    ).scalar() or 0

    avg_score = round((float(sub_avg) + float(test_avg)) / 2, 2) if (sub_avg or test_avg) else 0

    completed = db.query(Submission).join(Assignment).filter(
        Assignment.group_id == group_id,
        Submission.status == SubmissionStatusEnum.COMPLETED,
    ).count()
    completed += db.query(TestAttempt).join(TestAttempt.test).join(Assignment).filter(
        Assignment.group_id == group_id,
        TestAttempt.finished_at.isnot(None),
    ).count()

    overdue = db.query(Submission).join(Assignment).filter(
        Assignment.group_id == group_id,
        Submission.status == SubmissionStatusEnum.OVERDUE,
    ).count()

    return GroupStats(
        group=group,
        avg_score=avg_score,
        total_assignments=total,
        completed_count=completed,
        overdue_count=overdue,
        students=group.students,
    )


@router.get("/export/{group_id}")
def export_grades(group_id: int, token: str = Query(...), db: Session = Depends(get_db)):
    # Validate token
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("role") != "ADMIN":
            raise HTTPException(403, "Доступ запрещён")
    except Exception:
        raise HTTPException(401, "Неверный токен")

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Группа не найдена")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Оценки"
    ws.append(["Студент", "Email", "Задание", "Тип", "Оценка", "Статус", "Дата"])

    for student in group.students:
        subs = db.query(Submission).filter(Submission.student_id == student.id).all()
        for s in subs:
            a = s.assignment
            ws.append([
                student.name, student.email, a.title, a.type.value,
                s.score, s.status.value,
                s.submitted_at.strftime("%d.%m.%Y %H:%M") if s.submitted_at else "",
            ])
        attempts = db.query(TestAttempt).filter(TestAttempt.student_id == student.id).all()
        for att in attempts:
            a = att.test.assignment
            ws.append([
                student.name, student.email, a.title, "TEST",
                att.score, "COMPLETED" if att.finished_at else "IN_PROGRESS",
                att.finished_at.strftime("%d.%m.%Y %H:%M") if att.finished_at else "",
            ])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=grades_group_{group_id}.xlsx"},
    )


# ── Notifications ──────────────────────────────────────

@router.get("/notifications", response_model=List[NotificationOut])
def my_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Notification).filter(
        Notification.user_id == user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()


@router.put("/notifications/{n_id}/read")
def mark_read(n_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.query(Notification).filter(Notification.id == n_id, Notification.user_id == user.id).first()
    if not n:
        raise HTTPException(404, "Уведомление не найдено")
    n.is_read = True
    db.commit()
    return {"ok": True}


# ── My grades (student) ───────────────────────────────

@router.get("/my-grades")
def my_grades(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    subs = db.query(Submission).filter(Submission.student_id == user.id).all()
    attempts = db.query(TestAttempt).filter(TestAttempt.student_id == user.id).all()
    return {
        "submissions": [SubmissionOut.model_validate(s) for s in subs],
        "test_attempts": [TestAttemptOut.model_validate(a) for a in attempts],
    }
