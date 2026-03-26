import os
import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.config import settings
from app.models.models import (
    Assignment, Test, Question, Answer, Submission, TestAttempt, StudentAnswer,
    User, RoleEnum, AssignmentTypeEnum, SubmissionStatusEnum, Notification,
)
from app.schemas.schemas import (
    AssignmentCreate, AssignmentUpdate, AssignmentOut,
    TestOut, TestOutStudent, SubmissionOut, ScoreUpdate,
    SubmitTestRequest, TestAttemptOut,
)
from app.auth import require_admin, get_current_user, require_student

router = APIRouter(prefix="/api/assignments", tags=["assignments"])

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".zip", ".rar", ".7z", ".png", ".jpg", ".jpeg"}


def _save_file(upload: UploadFile) -> str:
    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Формат {ext} не поддерживается")
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, filename)
    content = upload.file.read()
    if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"Файл превышает {settings.MAX_FILE_SIZE_MB} МБ")
    with open(path, "wb") as f:
        f.write(content)
    return filename


# ── CRUD (admin) ───────────────────────────────────────

@router.get("/", response_model=List[AssignmentOut])
def list_assignments(
    theme_id: Optional[int] = None,
    group_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Assignment)
    if theme_id:
        q = q.filter(Assignment.theme_id == theme_id)
    if user.role == RoleEnum.STUDENT:
        q = q.filter(Assignment.group_id == user.group_id)
    elif group_id:
        q = q.filter(Assignment.group_id == group_id)
    return q.order_by(Assignment.deadline).all()


@router.post("/", response_model=AssignmentOut)
def create_assignment(data: AssignmentCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    assignment = Assignment(
        theme_id=data.theme_id,
        group_id=data.group_id,
        type=AssignmentTypeEnum(data.type),
        category_id=data.category_id,
        title=data.title,
        description=data.description,
        start_date=data.start_date,
        deadline=data.deadline,
        max_score=data.max_score,
    )
    db.add(assignment)
    db.flush()

    if data.type == "TEST" and data.test:
        test = Test(assignment_id=assignment.id)
        db.add(test)
        db.flush()
        for qd in data.test.questions:
            question = Question(
                test_id=test.id, text=qd.text, image=qd.image,
                multiple=qd.multiple, order=qd.order,
            )
            db.add(question)
            db.flush()
            for ad in qd.answers:
                db.add(Answer(question_id=question.id, text=ad.text, is_correct=ad.is_correct))

    db.commit()
    db.refresh(assignment)

    # Notify students in group
    from app.models.models import Group
    group = db.query(Group).filter(Group.id == data.group_id).first()
    if group:
        for student in group.students:
            db.add(Notification(
                user_id=student.id,
                title="Новое задание",
                message=f'Добавлено задание «{assignment.title}» с дедлайном {assignment.deadline.strftime("%d.%m.%Y %H:%M")}',
            ))
        db.commit()

    return assignment


@router.get("/{a_id}", response_model=AssignmentOut)
def get_assignment(a_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.query(Assignment).filter(Assignment.id == a_id).first()
    if not a:
        raise HTTPException(404, "Задание не найдено")
    return a


@router.put("/{a_id}", response_model=AssignmentOut)
def update_assignment(a_id: int, data: AssignmentUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    a = db.query(Assignment).filter(Assignment.id == a_id).first()
    if not a:
        raise HTTPException(404, "Задание не найдено")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return a


@router.delete("/{a_id}")
def delete_assignment(a_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    a = db.query(Assignment).filter(Assignment.id == a_id).first()
    if not a:
        raise HTTPException(404, "Задание не найдено")
    db.delete(a)
    db.commit()
    return {"ok": True}


# ── File upload for DOCUMENT assignment (admin attaches task file) ──

@router.post("/{a_id}/upload-task")
def upload_task_file(a_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    a = db.query(Assignment).filter(Assignment.id == a_id).first()
    if not a:
        raise HTTPException(404, "Задание не найдено")
    filename = _save_file(file)
    a.file_path = filename
    db.commit()
    return {"file": filename}


@router.get("/{a_id}/download-task")
def download_task_file(a_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.query(Assignment).filter(Assignment.id == a_id).first()
    if not a or not a.file_path:
        raise HTTPException(404, "Файл не найден")
    path = os.path.join(settings.UPLOAD_DIR, a.file_path)
    if not os.path.isfile(path):
        raise HTTPException(404, "Файл не найден на сервере")
    return FileResponse(path, filename=a.file_path)


# ── Test view ──────────────────────────────────────────

@router.get("/{a_id}/test", response_model=TestOutStudent)
def get_test_student(a_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.query(Assignment).filter(Assignment.id == a_id).first()
    if not a or a.type != AssignmentTypeEnum.TEST:
        raise HTTPException(404, "Тест не найден")
    test = db.query(Test).options(
        joinedload(Test.questions).joinedload(Question.answers)
    ).filter(Test.assignment_id == a_id).first()
    if not test:
        raise HTTPException(404, "Тест не найден")
    return test


@router.get("/{a_id}/test/admin", response_model=TestOut)
def get_test_admin(a_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    test = db.query(Test).options(
        joinedload(Test.questions).joinedload(Question.answers)
    ).filter(Test.assignment_id == a_id).first()
    if not test:
        raise HTTPException(404, "Тест не найден")
    return test


# ── Submit test ────────────────────────────────────────

@router.post("/{a_id}/submit-test", response_model=TestAttemptOut)
def submit_test(a_id: int, data: SubmitTestRequest, db: Session = Depends(get_db), student: User = Depends(require_student)):
    a = db.query(Assignment).filter(Assignment.id == a_id).first()
    if not a or a.type != AssignmentTypeEnum.TEST:
        raise HTTPException(404, "Тест не найден")

    # Check if there is already an attempt (unless re-attempt allowed)
    existing = db.query(TestAttempt).filter(
        TestAttempt.test_id == a.test.id,
        TestAttempt.student_id == student.id,
        TestAttempt.finished_at.isnot(None),
    ).first()
    if existing:
        raise HTTPException(400, "Вы уже прошли этот тест. Обратитесь к администратору для повторной попытки.")

    test = db.query(Test).options(
        joinedload(Test.questions).joinedload(Question.answers)
    ).filter(Test.assignment_id == a_id).first()

    total_questions = len(test.questions)
    if total_questions == 0:
        raise HTTPException(400, "В тесте нет вопросов")

    correct = 0
    attempt = TestAttempt(
        test_id=test.id,
        student_id=student.id,
        started_at=datetime.datetime.utcnow(),
    )
    db.add(attempt)
    db.flush()

    for question in test.questions:
        correct_ids = {ans.id for ans in question.answers if ans.is_correct}
        student_ids = set(data.answers.get(question.id, []))

        # Save student answers
        for aid in student_ids:
            db.add(StudentAnswer(attempt_id=attempt.id, question_id=question.id, answer_id=aid))

        if student_ids == correct_ids:
            correct += 1

    score = round((correct / total_questions) * a.max_score, 2)
    attempt.score = score
    attempt.finished_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(attempt)
    return attempt


# ── Submit document (student uploads answer file) ──────

@router.post("/{a_id}/submit-document", response_model=SubmissionOut)
def submit_document(
    a_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    student: User = Depends(require_student),
):
    a = db.query(Assignment).filter(Assignment.id == a_id).first()
    if not a:
        raise HTTPException(404, "Задание не найдено")

    existing = db.query(Submission).filter(
        Submission.assignment_id == a_id,
        Submission.student_id == student.id,
        Submission.status == SubmissionStatusEnum.COMPLETED,
    ).first()
    if existing:
        raise HTTPException(400, "Вы уже сдали это задание. Обратитесь к администратору для повторной попытки.")

    filename = _save_file(file)
    now = datetime.datetime.utcnow()
    status = SubmissionStatusEnum.COMPLETED
    if a.deadline and now > a.deadline:
        status = SubmissionStatusEnum.OVERDUE

    sub = Submission(
        student_id=student.id,
        assignment_id=a_id,
        file_path=filename,
        status=status,
        submitted_at=now,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.get("/{a_id}/submissions", response_model=List[SubmissionOut])
def list_submissions(a_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Submission).filter(Submission.assignment_id == a_id)
    if user.role == RoleEnum.STUDENT:
        q = q.filter(Submission.student_id == user.id)
    return q.all()


@router.get("/{a_id}/test-attempts", response_model=List[TestAttemptOut])
def list_test_attempts(a_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.query(Assignment).filter(Assignment.id == a_id).first()
    if not a or not a.test:
        raise HTTPException(404, "Тест не найден")
    q = db.query(TestAttempt).filter(TestAttempt.test_id == a.test.id)
    if user.role == RoleEnum.STUDENT:
        q = q.filter(TestAttempt.student_id == user.id)
    return q.all()


# ── Grade / score management (admin) ──────────────────

@router.put("/submissions/{sub_id}/score", response_model=SubmissionOut)
def update_submission_score(sub_id: int, data: ScoreUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    sub = db.query(Submission).filter(Submission.id == sub_id).first()
    if not sub:
        raise HTTPException(404, "Отправка не найдена")
    sub.score = data.score
    db.commit()
    db.refresh(sub)
    return sub


@router.put("/test-attempts/{att_id}/score", response_model=TestAttemptOut)
def update_test_attempt_score(att_id: int, data: ScoreUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    att = db.query(TestAttempt).filter(TestAttempt.id == att_id).first()
    if not att:
        raise HTTPException(404, "Попытка не найдена")
    att.score = data.score
    db.commit()
    db.refresh(att)
    return att


# ── Re-attempt (admin allows student to retake) ───────

@router.post("/{a_id}/re-attempt/{student_id}")
def allow_re_attempt(a_id: int, student_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    a = db.query(Assignment).filter(Assignment.id == a_id).first()
    if not a:
        raise HTTPException(404, "Задание не найдено")

    if a.type == AssignmentTypeEnum.TEST and a.test:
        attempts = db.query(TestAttempt).filter(
            TestAttempt.test_id == a.test.id,
            TestAttempt.student_id == student_id,
        ).all()
        for att in attempts:
            db.delete(att)
    else:
        subs = db.query(Submission).filter(
            Submission.assignment_id == a_id,
            Submission.student_id == student_id,
        ).all()
        for s in subs:
            db.delete(s)

    db.add(Notification(
        user_id=student_id,
        title="Повторная попытка",
        message=f'Вам назначена повторная попытка для задания «{a.title}»',
    ))
    db.commit()
    return {"ok": True}


# ── Download submission file ──────────────────────────

@router.get("/submissions/{sub_id}/download")
def download_submission(sub_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    sub = db.query(Submission).filter(Submission.id == sub_id).first()
    if not sub or not sub.file_path:
        raise HTTPException(404, "Файл не найден")
    if user.role == RoleEnum.STUDENT and sub.student_id != user.id:
        raise HTTPException(403, "Нет доступа")
    path = os.path.join(settings.UPLOAD_DIR, sub.file_path)
    if not os.path.isfile(path):
        raise HTTPException(404, "Файл не найден на сервере")
    return FileResponse(path, filename=sub.file_path)
