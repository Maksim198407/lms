from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.config import settings
from app.routers import auth, users, courses, groups, themes, categories, assignments, dashboard

Base.metadata.create_all(bind=engine)

app = FastAPI(title="LMS — Система управления обучением", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(courses.router)
app.include_router(groups.router)
app.include_router(themes.router)
app.include_router(categories.router)
app.include_router(assignments.router)
app.include_router(dashboard.router)

# Serve frontend static files
import os
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


# ── Create default admin on startup ───────────────────
@app.on_event("startup")
def create_default_admin():
    from app.database import SessionLocal
    from app.models.models import User, RoleEnum
    from app.auth import hash_password

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == RoleEnum.ADMIN).first()
        if not admin:
            db.add(User(
                name="Администратор",
                email="admin@lms.local",
                hashed_password=hash_password("admin123"),
                role=RoleEnum.ADMIN,
            ))
            db.commit()
    finally:
        db.close()
