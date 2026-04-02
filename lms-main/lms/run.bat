@echo off
echo ==========================================
echo    LMS - Система управления обучением
echo ==========================================
echo.

cd /d "%~dp0backend"

echo [1/2] Установка зависимостей...
pip install -r requirements.txt

echo.
echo [2/2] Запуск сервера...
echo.
echo  Откройте в браузере: http://localhost:8000
echo  Логин: admin@lms.local
echo  Пароль: admin123
echo.
echo  API docs: http://localhost:8000/docs
echo  Для остановки нажмите Ctrl+C
echo ==========================================

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
