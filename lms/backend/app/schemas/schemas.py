from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, EmailStr


# ── Auth ───────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int
    role: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ── User ───────────────────────────────────────────────
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "STUDENT"
    group_id: Optional[int] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    group_id: Optional[int] = None
    role: Optional[str] = None


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    group_id: Optional[int] = None
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Course ─────────────────────────────────────────────
class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class CourseOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Group ──────────────────────────────────────────────
class GroupCreate(BaseModel):
    name: str
    course_id: int


class GroupUpdate(BaseModel):
    name: Optional[str] = None


class GroupOut(BaseModel):
    id: int
    name: str
    course_id: int

    class Config:
        from_attributes = True


class GroupDetail(GroupOut):
    students: List[UserOut] = []

    class Config:
        from_attributes = True


# ── Theme ──────────────────────────────────────────────
class ThemeCreate(BaseModel):
    course_id: int
    title: str
    description: Optional[str] = None
    order: int = 0


class ThemeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None


class ThemeOut(BaseModel):
    id: int
    course_id: int
    title: str
    description: Optional[str] = None
    order: int

    class Config:
        from_attributes = True


# ── Category ──────────────────────────────────────────
class CategoryCreate(BaseModel):
    name: str


class CategoryUpdate(BaseModel):
    name: Optional[str] = None


class CategoryOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


# ── Answer ─────────────────────────────────────────────
class AnswerCreate(BaseModel):
    text: str
    is_correct: bool = False


class AnswerOut(BaseModel):
    id: int
    text: str
    is_correct: bool

    class Config:
        from_attributes = True


class AnswerOutStudent(BaseModel):
    id: int
    text: str

    class Config:
        from_attributes = True


# ── Question ───────────────────────────────────────────
class QuestionCreate(BaseModel):
    text: str
    image: Optional[str] = None
    multiple: bool = False
    order: int = 0
    answers: List[AnswerCreate] = []


class QuestionOut(BaseModel):
    id: int
    text: str
    image: Optional[str] = None
    multiple: bool
    order: int
    answers: List[AnswerOut] = []

    class Config:
        from_attributes = True


class QuestionOutStudent(BaseModel):
    id: int
    text: str
    image: Optional[str] = None
    multiple: bool
    order: int
    answers: List[AnswerOutStudent] = []

    class Config:
        from_attributes = True


# ── Test ───────────────────────────────────────────────
class TestCreate(BaseModel):
    questions: List[QuestionCreate] = []


class TestOut(BaseModel):
    id: int
    assignment_id: int
    questions: List[QuestionOut] = []

    class Config:
        from_attributes = True


class TestOutStudent(BaseModel):
    id: int
    assignment_id: int
    questions: List[QuestionOutStudent] = []

    class Config:
        from_attributes = True


# ── Assignment ─────────────────────────────────────────
class AssignmentCreate(BaseModel):
    theme_id: int
    group_id: int
    type: str  # TEST or DOCUMENT
    category_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    deadline: datetime
    max_score: int = 100
    test: Optional[TestCreate] = None


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    max_score: Optional[int] = None


class AssignmentOut(BaseModel):
    id: int
    theme_id: int
    group_id: int
    type: str
    category_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    file_path: Optional[str] = None
    start_date: Optional[datetime] = None
    deadline: datetime
    max_score: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Submission ─────────────────────────────────────────
class SubmissionOut(BaseModel):
    id: int
    student_id: int
    assignment_id: int
    file_path: Optional[str] = None
    score: Optional[float] = None
    status: str
    submitted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScoreUpdate(BaseModel):
    score: float


# ── Test Attempt ───────────────────────────────────────
class SubmitTestRequest(BaseModel):
    answers: Dict[int, List[int]]  # question_id -> [answer_ids]


class TestAttemptOut(BaseModel):
    id: int
    test_id: int
    student_id: int
    score: Optional[float] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Dashboard ──────────────────────────────────────────
class StudentDashboard(BaseModel):
    student: UserOut
    scores: List[SubmissionOut] = []
    test_scores: List[TestAttemptOut] = []

    class Config:
        from_attributes = True


class GroupStats(BaseModel):
    group: GroupOut
    avg_score: float = 0
    total_assignments: int = 0
    completed_count: int = 0
    overdue_count: int = 0
    students: List[UserOut] = []

    class Config:
        from_attributes = True


# ── Notification ───────────────────────────────────────
class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    is_read: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
