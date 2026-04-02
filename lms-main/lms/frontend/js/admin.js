/* ── Admin Pages ─────────────────────────────────── */

// ── Admin Dashboard ──
registerRoute('/', async () => {
    const user = getUser();
    if (!user) { navigateTo('/login'); return; }
    setupNavbar(user);
    if (user.role === 'ADMIN') {
        setTopbarTitle('Панель управления');
        await renderAdminDashboard();
    } else {
        setTopbarTitle('Мои курсы');
        await renderStudentCourses();
    }
});

async function renderAdminDashboard() {
    const [courses, groups, users] = await Promise.all([
        apiGet('/courses/'),
        apiGet('/groups/'),
        apiGet('/users/?role=STUDENT'),
    ]);

    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="page-header">
            <h1>Панель управления</h1>
            <p>Обзор системы обучения</p>
        </div>
        <div class="stats-grid">
            <div class="stat-card purple">
                <div class="stat-icon purple"><span class="material-icons-round">auto_stories</span></div>
                <div class="stat-value">${courses.length}</div>
                <div class="stat-label">Курсов</div>
            </div>
            <div class="stat-card emerald">
                <div class="stat-icon emerald"><span class="material-icons-round">groups</span></div>
                <div class="stat-value">${groups.length}</div>
                <div class="stat-label">Групп</div>
            </div>
            <div class="stat-card sky">
                <div class="stat-icon sky"><span class="material-icons-round">people</span></div>
                <div class="stat-value">${users.length}</div>
                <div class="stat-label">Студентов</div>
            </div>
        </div>

        <div class="card card-elevated">
            <div class="card-header">
                <div>
                    <div class="card-title">Группы и статистика</div>
                    <div class="card-subtitle">Управление учебными группами</div>
                </div>
            </div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Группа</th><th>Курс</th><th>Действия</th></tr></thead>
                    <tbody>
                        ${groups.length === 0 ? `<tr><td colspan="3" class="text-center text-muted" style="padding:32px">Нет групп</td></tr>` :
                        groups.map(g => {
                            const c = courses.find(c => c.id === g.course_id);
                            return `<tr>
                                <td class="font-semibold">${g.name}</td>
                                <td>${c ? c.title : '—'}</td>
                                <td>
                                    <div class="btn-group">
                                        <button class="btn btn-sm btn-primary" onclick="viewGroupStats(${g.id})">
                                            <span class="material-icons-round">analytics</span> Статистика
                                        </button>
                                        <button class="btn btn-sm btn-ghost" onclick="exportGrades(${g.id})">
                                            <span class="material-icons-round">download</span> Excel
                                        </button>
                                    </div>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function viewGroupStats(groupId) {
    const stats = await apiGet(`/dashboard/group/${groupId}`);
    const html = `
        <div class="stats-grid" style="margin-bottom:24px">
            <div class="stat-card purple"><div class="stat-icon purple"><span class="material-icons-round">trending_up</span></div><div class="stat-value">${stats.avg_score}</div><div class="stat-label">Средний балл</div></div>
            <div class="stat-card sky"><div class="stat-icon sky"><span class="material-icons-round">assignment</span></div><div class="stat-value">${stats.total_assignments}</div><div class="stat-label">Заданий</div></div>
            <div class="stat-card emerald"><div class="stat-icon emerald"><span class="material-icons-round">check_circle</span></div><div class="stat-value">${stats.completed_count}</div><div class="stat-label">Выполнено</div></div>
            <div class="stat-card red"><div class="stat-icon red"><span class="material-icons-round">schedule</span></div><div class="stat-value">${stats.overdue_count}</div><div class="stat-label">Просрочено</div></div>
        </div>
        <div class="card-title mb-16">Студенты группы</div>
        <div class="table-wrap">
        <table>
            <thead><tr><th>Имя</th><th>Email</th><th>Последний вход</th><th>Действия</th></tr></thead>
            <tbody>
                ${stats.students.map(s => `<tr>
                    <td class="font-semibold">${s.name}</td>
                    <td class="text-muted">${s.email}</td>
                    <td class="text-sm">${s.last_login ? formatDate(s.last_login) : '<span class="text-muted">Ещё нет</span>'}</td>
                    <td><button class="btn btn-sm btn-ghost" onclick="viewStudentDashboard(${s.id})"><span class="material-icons-round">visibility</span> Подробнее</button></td>
                </tr>`).join('')}
            </tbody>
        </table>
        </div>
    `;
    showModal(`Статистика: ${stats.group.name}`, html);
}

async function viewStudentDashboard(studentId) {
    const data = await apiGet(`/dashboard/student/${studentId}`);
    const allScores = [...data.scores, ...data.test_scores];
    const html = `
        <p><strong>${data.student.name}</strong> — ${data.student.email}</p>
        <p class="text-sm text-muted mb-16">Последний вход: ${data.student.last_login ? formatDate(data.student.last_login) : 'Нет'}</p>
        <h4 class="mb-16">Оценки за задания</h4>
        <table>
            <thead><tr><th>ID Задания</th><th>Оценка</th><th>Статус</th><th>Дата</th></tr></thead>
            <tbody>
                ${data.scores.map(s => `<tr>
                    <td>${s.assignment_id}</td>
                    <td>${s.score !== null ? s.score : '—'}</td>
                    <td>${statusBadge(s.status)}</td>
                    <td>${s.submitted_at ? formatDate(s.submitted_at) : '—'}</td>
                </tr>`).join('')}
                ${data.test_scores.map(t => `<tr>
                    <td>Тест #${t.test_id}</td>
                    <td>${t.score !== null ? t.score : '—'}</td>
                    <td>${t.finished_at ? statusBadge('COMPLETED') : statusBadge('IN_PROGRESS')}</td>
                    <td>${t.finished_at ? formatDate(t.finished_at) : '—'}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    `;
    showModal(`Студент: ${data.student.name}`, html);
}

function exportGrades(groupId) {
    window.open(`${API_BASE}/dashboard/export/${groupId}?token=${getToken()}`, '_blank');
}

// ── Courses CRUD ──
registerRoute('/courses', async () => {
    setupNavbar(getUser());
    setTopbarTitle('Курсы');
    const courses = await apiGet('/courses/');
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="page-header flex-between">
            <div>
                <h1>Курсы</h1>
                <p>Управление учебными курсами</p>
            </div>
            <button class="btn btn-primary" onclick="showCourseForm()">
                <span class="material-icons-round">add</span> Создать курс
            </button>
        </div>
        ${courses.length === 0 ? `
            <div class="empty-state">
                <span class="material-icons-round">auto_stories</span>
                <p>Курсов пока нет. Создайте первый курс.</p>
            </div>` : `
        <div class="courses-grid">
            ${courses.map(c => `
                <div class="course-card" onclick="navigateTo('/courses/${c.id}')">
                    <div class="course-card-banner"></div>
                    <div class="course-card-body">
                        <div class="course-card-title">${c.title}</div>
                        <div class="course-card-desc">${c.description || 'Без описания'}</div>
                    </div>
                    <div class="course-card-footer">
                        <span><span class="material-icons-round" style="font-size:14px;vertical-align:-2px">calendar_today</span> ${formatDate(c.created_at)}</span>
                        <div class="btn-group" onclick="event.stopPropagation()">
                            <button class="btn btn-icon-only btn-ghost" onclick="showCourseForm(${c.id})" title="Редактировать">
                                <span class="material-icons-round">edit</span>
                            </button>
                            <button class="btn btn-icon-only btn-ghost" onclick="deleteCourse(${c.id})" title="Удалить" style="color:var(--red-500)">
                                <span class="material-icons-round">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>`}`;
});

async function showCourseForm(id) {
    let course = { title: '', description: '' };
    if (id) course = await apiGet(`/courses/${id}`);
    const html = `
        <form id="course-form">
            <div class="form-group">
                <label class="form-label">Название</label>
                <input class="form-input" id="cf-title" value="${course.title}" required placeholder="Введите название курса">
            </div>
            <div class="form-group">
                <label class="form-label">Описание</label>
                <textarea class="form-textarea" id="cf-desc" rows="3" placeholder="Описание курса...">${course.description || ''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary w-full">
                <span class="material-icons-round">${id ? 'save' : 'add'}</span> ${id ? 'Сохранить' : 'Создать'}
            </button>
        </form>`;
    showModal(id ? 'Редактировать курс' : 'Новый курс', html);
    document.getElementById('course-form').onsubmit = async (e) => {
        e.preventDefault();
        const body = {
            title: document.getElementById('cf-title').value,
            description: document.getElementById('cf-desc').value,
        };
        if (id) await apiPut(`/courses/${id}`, body);
        else await apiPost('/courses/', body);
        closeModal();
        showToast(id ? 'Курс обновлён' : 'Курс создан', 'success');
        navigateTo('/courses');
        handleRoute();
    };
}

async function deleteCourse(id) {
    if (!confirm('Удалить курс?')) return;
    await apiDelete(`/courses/${id}`);
    handleRoute();
}

// ── Course Detail (Themes & Assignments) ──
registerRoute('/courses/:id', async ({ id }) => {
    setupNavbar(getUser());
    setTopbarTitle('Детали курса');
    const user = getUser();
    const [course, themes, groups, categories] = await Promise.all([
        apiGet(`/courses/${id}`),
        apiGet(`/themes/?course_id=${id}`),
        apiGet(`/groups/?course_id=${id}`),
        apiGet('/categories/'),
    ]);

    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="page-header flex-between">
            <div>
                <h1>${course.title}</h1>
                <p>${course.description || ''}</p>
            </div>
            ${user.role === 'ADMIN' ? `<button class="btn btn-primary" onclick="showThemeForm(${id})"><span class="material-icons-round">add</span> Новая тема</button>` : ''}
        </div>
        <div id="themes-list"></div>
    `;

    const container = document.getElementById('themes-list');
    for (const theme of themes) {
        const assignments = await apiGet(`/assignments/?theme_id=${theme.id}`);
        container.innerHTML += `
            <div class="theme-card">
                <div class="theme-header" onclick="this.parentElement.querySelector('.theme-body')?.classList.toggle('hidden')">
                    <div class="theme-icon"><span class="material-icons-round">topic</span></div>
                    <div class="theme-info">
                        <div class="theme-title">${theme.title}</div>
                        ${theme.description ? `<div class="theme-desc">${theme.description}</div>` : ''}
                    </div>
                    <span class="badge badge-muted">${assignments.length} заданий</span>
                    ${user.role === 'ADMIN' ? `
                    <div class="theme-actions" onclick="event.stopPropagation()">
                        <button class="btn btn-sm btn-primary" onclick="showAssignmentForm(${theme.id}, ${id})"><span class="material-icons-round">add</span> Задание</button>
                        <button class="btn btn-icon-only btn-ghost" onclick="showThemeForm(${id}, ${theme.id})"><span class="material-icons-round">edit</span></button>
                        <button class="btn btn-icon-only btn-ghost" style="color:var(--red-500)" onclick="deleteTheme(${theme.id}, ${id})"><span class="material-icons-round">delete</span></button>
                    </div>` : ''}
                </div>
                <div class="theme-body">
                    ${assignments.length > 0 ? assignments.map(a => `
                        <div class="assignment-row" onclick="navigateTo('/assignments/${a.id}')" style="cursor:pointer">
                            <div class="assignment-type-icon ${a.type === 'TEST' ? 'test' : 'document'}">
                                <span class="material-icons-round">${a.type === 'TEST' ? 'quiz' : 'description'}</span>
                            </div>
                            <div class="assignment-info">
                                <div class="assignment-name">${a.title}</div>
                                <div class="assignment-meta">
                                    <span>${a.type === 'TEST' ? 'Тест' : 'Документ'}</span>
                                    <span><span class="material-icons-round" style="font-size:13px;vertical-align:-2px">schedule</span> ${formatDate(a.deadline)}</span>
                                    <span>Макс: ${a.max_score}</span>
                                </div>
                            </div>
                            ${user.role === 'ADMIN' ? `
                            <div class="btn-group" onclick="event.stopPropagation()">
                                <button class="btn btn-icon-only btn-ghost" style="color:var(--red-500)" onclick="deleteAssignment(${a.id}, ${id})"><span class="material-icons-round">delete</span></button>
                            </div>` : ''}
                        </div>
                    `).join('') : `
                        <div class="empty-state" style="padding:24px">
                            <span class="material-icons-round" style="font-size:32px">assignment</span>
                            <p class="text-sm">Нет заданий</p>
                        </div>`}
                </div>
            </div>`;
    }
    if (themes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons-round">book</span>
                <p>Нет тем. Создайте первую тему для этого курса.</p>
            </div>`;
    }

    window._courseGroups = groups;
    window._courseCategories = categories;
});

async function showThemeForm(courseId, themeId) {
    let theme = { title: '', description: '', order: 0 };
    if (themeId) theme = await apiGet(`/themes/${themeId}`);
    const html = `
        <form id="theme-form">
            <div class="form-group">
                <label class="form-label">Название</label>
                <input class="form-input" id="tf-title" value="${theme.title}" required placeholder="Название темы">
            </div>
            <div class="form-group">
                <label class="form-label">Описание</label>
                <textarea class="form-textarea" id="tf-desc" rows="2" placeholder="Краткое описание...">${theme.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Порядок</label>
                <input class="form-input" id="tf-order" type="number" value="${theme.order}">
            </div>
            <button type="submit" class="btn btn-primary w-full">
                <span class="material-icons-round">${themeId ? 'save' : 'add'}</span> ${themeId ? 'Сохранить' : 'Создать'}
            </button>
        </form>`;
    showModal(themeId ? 'Редактировать тему' : 'Новая тема', html);
    document.getElementById('theme-form').onsubmit = async (e) => {
        e.preventDefault();
        const body = {
            course_id: courseId,
            title: document.getElementById('tf-title').value,
            description: document.getElementById('tf-desc').value,
            order: parseInt(document.getElementById('tf-order').value) || 0,
        };
        if (themeId) await apiPut(`/themes/${themeId}`, body);
        else await apiPost('/themes/', body);
        closeModal();
        showToast(themeId ? 'Тема обновлена' : 'Тема создана', 'success');
        handleRoute();
    };
}

async function deleteTheme(themeId, courseId) {
    if (!confirm('Удалить тему и все задания?')) return;
    await apiDelete(`/themes/${themeId}`);
    handleRoute();
}

async function deleteAssignment(aId, courseId) {
    if (!confirm('Удалить задание?')) return;
    await apiDelete(`/assignments/${aId}`);
    handleRoute();
}

// ── Assignment Create Form ──
async function showAssignmentForm(themeId, courseId) {
    const groups = window._courseGroups || [];
    const categories = window._courseCategories || [];
    const html = `
        <form id="assign-form">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Название</label>
                    <input class="form-input" id="af-title" required placeholder="Название задания">
                </div>
                <div class="form-group">
                    <label class="form-label">Тип</label>
                    <select class="form-select" id="af-type" onchange="toggleTestForm()">
                        <option value="DOCUMENT">Документ</option>
                        <option value="TEST">Тест</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Описание</label>
                <textarea class="form-textarea" id="af-desc" rows="2" placeholder="Описание задания..."></textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Группа</label>
                    <select class="form-select" id="af-group" required>
                        ${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Категория</label>
                    <select class="form-select" id="af-cat">
                        <option value="">— Без категории —</option>
                        ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Дата начала</label>
                    <input class="form-input" id="af-start" type="datetime-local">
                </div>
                <div class="form-group">
                    <label class="form-label">Дедлайн</label>
                    <input class="form-input" id="af-deadline" type="datetime-local" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Макс. оценка</label>
                <input class="form-input" id="af-max" type="number" value="100">
            </div>

            <div id="test-section" class="hidden">
                <div class="divider"></div>
                <div class="flex-between mb-16">
                    <div class="card-title">Вопросы теста</div>
                    <button type="button" class="btn btn-sm btn-ghost" onclick="addQuestionField()">
                        <span class="material-icons-round">add</span> Вопрос
                    </button>
                </div>
                <div id="questions-list"></div>
            </div>

            <div class="mt-24">
                <button type="submit" class="btn btn-primary w-full">
                    <span class="material-icons-round">add</span> Создать задание
                </button>
            </div>
        </form>`;
    showModal('Новое задание', html);
    window._questionCount = 0;

    document.getElementById('assign-form').onsubmit = async (e) => {
        e.preventDefault();
        const type = document.getElementById('af-type').value;
        const body = {
            theme_id: themeId,
            group_id: parseInt(document.getElementById('af-group').value),
            type: type,
            category_id: document.getElementById('af-cat').value ? parseInt(document.getElementById('af-cat').value) : null,
            title: document.getElementById('af-title').value,
            description: document.getElementById('af-desc').value,
            start_date: document.getElementById('af-start').value || null,
            deadline: document.getElementById('af-deadline').value,
            max_score: parseInt(document.getElementById('af-max').value) || 100,
        };

        if (type === 'TEST') {
            body.test = { questions: collectQuestions() };
        }

        await apiPost('/assignments/', body);
        closeModal();
        showToast('Задание создано', 'success');
        handleRoute();
    };
}

function toggleTestForm() {
    const section = document.getElementById('test-section');
    if (document.getElementById('af-type').value === 'TEST') {
        section.classList.remove('hidden');
    } else {
        section.classList.add('hidden');
    }
}

function addQuestionField() {
    const idx = window._questionCount++;
    const container = document.getElementById('questions-list');
    const div = document.createElement('div');
    div.className = 'question-card';
    div.id = `question-${idx}`;
    div.innerHTML = `
        <div class="form-group">
            <label class="form-label"><span class="question-number">${idx + 1}</span> Текст вопроса</label>
            <input class="form-input q-text" required placeholder="Введите вопрос">
        </div>
        <div class="form-check">
            <input type="checkbox" class="q-multiple">
            <label>Несколько правильных ответов</label>
        </div>
        <div class="answers-list"></div>
        <button type="button" class="btn btn-sm btn-ghost mt-8" onclick="addAnswerField(${idx})">
            <span class="material-icons-round">add</span> Вариант ответа
        </button>
    `;
    container.appendChild(div);
    addAnswerField(idx);
    addAnswerField(idx);
}

function addAnswerField(qIdx) {
    const list = document.querySelector(`#question-${qIdx} .answers-list`);
    const div = document.createElement('div');
    div.className = 'form-check';
    div.innerHTML = `
        <input type="checkbox" class="a-correct" title="Отметить как правильный">
        <input class="form-input a-text" placeholder="Вариант ответа" style="flex:1" required>
    `;
    list.appendChild(div);
}

function collectQuestions() {
    const questions = [];
    document.querySelectorAll('[id^="question-"]').forEach((qEl, i) => {
        const text = qEl.querySelector('.q-text').value;
        const multiple = qEl.querySelector('.q-multiple').checked;
        const answers = [];
        qEl.querySelectorAll('.answers-list .form-check').forEach(aEl => {
            answers.push({
                text: aEl.querySelector('.a-text').value,
                is_correct: aEl.querySelector('.a-correct').checked,
            });
        });
        questions.push({ text, multiple, order: i, answers });
    });
    return questions;
}

// ── Assignment Detail (admin + student) ──
registerRoute('/assignments/:id', async ({ id }) => {
    const user = getUser();
    setupNavbar(user);
    setTopbarTitle('Задание');
    const a = await apiGet(`/assignments/${id}`);

    if (user.role === 'ADMIN') {
        await renderAdminAssignment(a);
    } else {
        await renderStudentAssignment(a);
    }
});

async function renderAdminAssignment(a) {
    const main = document.getElementById('main-content');
    let testHtml = '';
    let submissionsHtml = '';

    if (a.type === 'TEST') {
        try {
            const test = await apiGet(`/assignments/${a.id}/test/admin`);
            const attempts = await apiGet(`/assignments/${a.id}/test-attempts`);
            testHtml = `
                <div class="card card-elevated">
                    <div class="card-header">
                        <div class="card-title"><span class="material-icons-round" style="vertical-align:-4px;margin-right:8px;color:var(--primary-500)">quiz</span>Вопросы теста (${test.questions.length})</div>
                    </div>
                    ${test.questions.map((q, i) => `
                        <div class="question-card">
                            <div class="question-text"><span class="question-number">${i + 1}</span>${q.text} ${q.multiple ? '<span class="badge badge-info">Мультивыбор</span>' : ''}</div>
                            ${q.answers.map(ans => `
                                <div class="answer-correct ${ans.is_correct ? 'yes' : 'no'}">
                                    <span class="material-icons-round" style="font-size:16px;vertical-align:-3px">${ans.is_correct ? 'check_circle' : 'radio_button_unchecked'}</span> ${ans.text}
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
                <div class="card card-elevated">
                    <div class="card-header">
                        <div class="card-title"><span class="material-icons-round" style="vertical-align:-4px;margin-right:8px;color:var(--sky-500)">people</span>Попытки студентов</div>
                    </div>
                    <div class="table-wrap">
                    <table>
                        <thead><tr><th>Студент ID</th><th>Оценка</th><th>Дата</th><th>Действия</th></tr></thead>
                        <tbody>
                            ${attempts.length === 0 ? '<tr><td colspan="4" class="text-center text-muted" style="padding:24px">Попыток пока нет</td></tr>' :
                            attempts.map(att => `<tr>
                                <td class="font-semibold">${att.student_id}</td>
                                <td>${att.score !== null ? `<span class="font-bold">${att.score}</span>` : '<span class="text-muted">—</span>'}</td>
                                <td class="text-sm">${att.finished_at ? formatDate(att.finished_at) : '<span class="badge badge-warning badge-dot">В процессе</span>'}</td>
                                <td>
                                    <div class="btn-group">
                                        <button class="btn btn-sm btn-ghost" onclick="editTestScore(${att.id}, ${att.score || 0})">
                                            <span class="material-icons-round">grade</span> Оценка
                                        </button>
                                        <button class="btn btn-sm btn-ghost" onclick="allowReAttempt(${a.id}, ${att.student_id})">
                                            <span class="material-icons-round">replay</span> Повтор
                                        </button>
                                    </div>
                                </td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                    </div>
                </div>`;
        } catch (e) {
            testHtml = `<div class="alert alert-error"><span class="material-icons-round">error</span> ${e.message}</div>`;
        }
    } else {
        const subs = await apiGet(`/assignments/${a.id}/submissions`);
        submissionsHtml = `
            <div class="card card-elevated">
                <div class="card-header">
                    <div class="card-title"><span class="material-icons-round" style="vertical-align:-4px;margin-right:8px;color:var(--emerald-500)">assignment_turned_in</span>Сдачи студентов</div>
                </div>
                ${a.file_path ? `
                    <div class="mb-16"><a href="${API_BASE}/assignments/${a.id}/download-task" target="_blank" class="btn btn-sm btn-ghost">
                        <span class="material-icons-round">attach_file</span> Скачать файл задания
                    </a></div>` : `
                    <div class="mb-16">
                        <input type="file" id="task-file" class="form-file-input">
                        <button class="btn btn-sm btn-primary mt-8" onclick="uploadTaskFile(${a.id})">
                            <span class="material-icons-round">upload</span> Загрузить файл задания
                        </button>
                    </div>
                `}
                <div class="table-wrap">
                <table>
                    <thead><tr><th>Студент ID</th><th>Оценка</th><th>Статус</th><th>Дата</th><th>Действия</th></tr></thead>
                    <tbody>
                        ${subs.length === 0 ? '<tr><td colspan="5" class="text-center text-muted" style="padding:24px">Сдач пока нет</td></tr>' :
                        subs.map(s => `<tr>
                            <td class="font-semibold">${s.student_id}</td>
                            <td>${s.score !== null ? `<span class="font-bold">${s.score}</span>` : '<span class="text-muted">—</span>'}</td>
                            <td>${statusBadge(s.status)}</td>
                            <td class="text-sm">${s.submitted_at ? formatDate(s.submitted_at) : '—'}</td>
                            <td>
                                <div class="btn-group">
                                    <a href="${API_BASE}/assignments/submissions/${s.id}/download" target="_blank" class="btn btn-sm btn-ghost">
                                        <span class="material-icons-round">download</span>
                                    </a>
                                    <button class="btn btn-sm btn-ghost" onclick="editSubScore(${s.id}, ${s.score || 0})">
                                        <span class="material-icons-round">grade</span> Оценка
                                    </button>
                                    <button class="btn btn-sm btn-ghost" onclick="allowReAttempt(${a.id}, ${s.student_id})">
                                        <span class="material-icons-round">replay</span> Повтор
                                    </button>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
                </div>
            </div>`;
    }

    main.innerHTML = `
        <div class="page-header flex-between">
            <div>
                <h1>${a.title}</h1>
                <p>${a.description || ''}</p>
            </div>
            <span class="badge ${a.type === 'TEST' ? 'badge-info' : 'badge-warning'}">${a.type === 'TEST' ? 'Тест' : 'Документ'}</span>
        </div>
        <div class="stats-grid">
            <div class="stat-card purple">
                <div class="stat-icon purple"><span class="material-icons-round">star</span></div>
                <div class="stat-value">${a.max_score}</div>
                <div class="stat-label">Макс. балл</div>
            </div>
            <div class="stat-card amber">
                <div class="stat-icon amber"><span class="material-icons-round">schedule</span></div>
                <div class="stat-value text-sm" style="font-size:1rem">${formatDate(a.deadline)}</div>
                <div class="stat-label">Дедлайн</div>
            </div>
        </div>
        ${testHtml}
        ${submissionsHtml}
    `;
}

async function uploadTaskFile(aId) {
    const fileInput = document.getElementById('task-file');
    if (!fileInput.files[0]) return alert('Выберите файл');
    await apiUpload(`/assignments/${aId}/upload-task`, fileInput.files[0]);
    handleRoute();
}

async function editSubScore(subId, current) {
    const score = prompt('Введите оценку:', current);
    if (score === null) return;
    await apiPut(`/assignments/submissions/${subId}/score`, { score: parseFloat(score) });
    handleRoute();
}

async function editTestScore(attId, current) {
    const score = prompt('Введите оценку:', current);
    if (score === null) return;
    await apiPut(`/assignments/test-attempts/${attId}/score`, { score: parseFloat(score) });
    handleRoute();
}

async function allowReAttempt(aId, studentId) {
    if (!confirm('Разрешить повторную попытку?')) return;
    await apiPost(`/assignments/${aId}/re-attempt/${studentId}`, {});
    alert('Повторная попытка назначена');
    handleRoute();
}

// ── Groups CRUD ──
registerRoute('/groups', async () => {
    setupNavbar(getUser());
    setTopbarTitle('Группы');
    const [groups, courses] = await Promise.all([
        apiGet('/groups/'),
        apiGet('/courses/'),
    ]);
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="page-header flex-between">
            <div>
                <h1>Группы</h1>
                <p>Управление учебными группами</p>
            </div>
            <button class="btn btn-primary" onclick="showGroupForm(null, ${JSON.stringify(courses).replace(/"/g, '&quot;')})">
                <span class="material-icons-round">add</span> Создать группу
            </button>
        </div>
        <div class="card card-elevated">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Группа</th><th>Курс</th><th>Действия</th></tr></thead>
                    <tbody>
                        ${groups.length === 0 ? '<tr><td colspan="3" class="text-center text-muted" style="padding:32px">Нет групп</td></tr>' :
                        groups.map(g => {
                            const c = courses.find(c => c.id === g.course_id);
                            return `<tr>
                                <td class="font-semibold">${g.name}</td>
                                <td>${c ? c.title : '—'}</td>
                                <td>
                                    <div class="btn-group">
                                        <button class="btn btn-icon-only btn-ghost" onclick='showGroupForm(${JSON.stringify(g).replace(/'/g, "\\'")})'><span class="material-icons-round">edit</span></button>
                                        <button class="btn btn-icon-only btn-ghost" style="color:var(--red-500)" onclick="deleteGroup(${g.id})"><span class="material-icons-round">delete</span></button>
                                    </div>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
});

async function showGroupForm(group, courses) {
    if (!courses) courses = await apiGet('/courses/');
    const isEdit = group && group.id;
    const html = `
        <form id="group-form">
            <div class="form-group">
                <label class="form-label">Название</label>
                <input class="form-input" id="gf-name" value="${isEdit ? group.name : ''}" required placeholder="Название группы">
            </div>
            <div class="form-group">
                <label class="form-label">Курс</label>
                <select class="form-select" id="gf-course" ${isEdit ? 'disabled' : ''} required>
                    ${courses.map(c => `<option value="${c.id}" ${isEdit && c.id === group.course_id ? 'selected' : ''}>${c.title}</option>`).join('')}
                </select>
            </div>
            <button type="submit" class="btn btn-primary w-full">
                <span class="material-icons-round">${isEdit ? 'save' : 'add'}</span> ${isEdit ? 'Сохранить' : 'Создать'}
            </button>
        </form>`;
    showModal(isEdit ? 'Редактировать группу' : 'Новая группа', html);
    document.getElementById('group-form').onsubmit = async (e) => {
        e.preventDefault();
        const body = { name: document.getElementById('gf-name').value };
        if (isEdit) {
            await apiPut(`/groups/${group.id}`, body);
        } else {
            body.course_id = parseInt(document.getElementById('gf-course').value);
            await apiPost('/groups/', body);
        }
        closeModal();
        showToast(isEdit ? 'Группа обновлена' : 'Группа создана', 'success');
        navigateTo('/groups');
        handleRoute();
    };
}

async function deleteGroup(id) {
    if (!confirm('Удалить группу?')) return;
    await apiDelete(`/groups/${id}`);
    handleRoute();
}

// ── Users CRUD ──
registerRoute('/users', async () => {
    setupNavbar(getUser());
    setTopbarTitle('Пользователи');
    const [users, groups] = await Promise.all([
        apiGet('/users/'),
        apiGet('/groups/'),
    ]);
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="page-header flex-between">
            <div>
                <h1>Пользователи</h1>
                <p>Управление пользователями системы</p>
            </div>
            <button class="btn btn-primary" onclick="showUserForm()">
                <span class="material-icons-round">person_add</span> Добавить
            </button>
        </div>
        <div class="card card-elevated">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Группа</th><th>Действия</th></tr></thead>
                    <tbody>
                        ${users.map(u => {
                            const g = groups.find(g => g.id === u.group_id);
                            return `<tr>
                                <td class="font-semibold">${u.name}</td>
                                <td class="text-muted">${u.email}</td>
                                <td>${u.role === 'ADMIN' ? '<span class="badge badge-danger">Админ</span>' : '<span class="badge badge-info">Студент</span>'}</td>
                                <td>${g ? g.name : '<span class="text-muted">—</span>'}</td>
                                <td>
                                    <div class="btn-group">
                                        <button class="btn btn-icon-only btn-ghost" onclick="showEditUser(${u.id})"><span class="material-icons-round">edit</span></button>
                                        <button class="btn btn-icon-only btn-ghost" style="color:var(--red-500)" onclick="deleteUser(${u.id})"><span class="material-icons-round">delete</span></button>
                                    </div>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    window._groups = groups;
});

async function showUserForm() {
    const groups = window._groups || await apiGet('/groups/');
    const html = `
        <form id="user-form">
            <div class="form-group">
                <label class="form-label">Имя</label>
                <input class="form-input" id="uf-name" required placeholder="Полное имя">
            </div>
            <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-input" id="uf-email" type="email" required placeholder="email@example.com">
            </div>
            <div class="form-group">
                <label class="form-label">Пароль</label>
                <input class="form-input" id="uf-pass" type="password" required placeholder="Минимум 6 символов">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Роль</label>
                    <select class="form-select" id="uf-role">
                        <option value="STUDENT">Студент</option>
                        <option value="ADMIN">Администратор</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Группа</label>
                    <select class="form-select" id="uf-group">
                        <option value="">— Без группы —</option>
                        ${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <button type="submit" class="btn btn-primary w-full">
                <span class="material-icons-round">person_add</span> Создать
            </button>
        </form>`;
    showModal('Новый пользователь', html);
    document.getElementById('user-form').onsubmit = async (e) => {
        e.preventDefault();
        await apiPost('/users/', {
            name: document.getElementById('uf-name').value,
            email: document.getElementById('uf-email').value,
            password: document.getElementById('uf-pass').value,
            role: document.getElementById('uf-role').value,
            group_id: document.getElementById('uf-group').value ? parseInt(document.getElementById('uf-group').value) : null,
        });
        closeModal();
        showToast('Пользователь создан', 'success');
        handleRoute();
    };
}

async function showEditUser(userId) {
    const user = await apiGet(`/users/${userId}`);
    const groups = window._groups || await apiGet('/groups/');
    const html = `
        <form id="user-edit-form">
            <div class="form-group">
                <label class="form-label">Имя</label>
                <input class="form-input" id="ue-name" value="${user.name}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-input" id="ue-email" type="email" value="${user.email}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Роль</label>
                    <select class="form-select" id="ue-role">
                        <option value="STUDENT" ${user.role === 'STUDENT' ? 'selected' : ''}>Студент</option>
                        <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>Администратор</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Группа</label>
                    <select class="form-select" id="ue-group">
                        <option value="">— Без группы —</option>
                        ${groups.map(g => `<option value="${g.id}" ${user.group_id === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <button type="submit" class="btn btn-primary w-full">
                <span class="material-icons-round">save</span> Сохранить
            </button>
        </form>`;
    showModal('Редактировать пользователя', html);
    document.getElementById('user-edit-form').onsubmit = async (e) => {
        e.preventDefault();
        await apiPut(`/users/${userId}`, {
            name: document.getElementById('ue-name').value,
            email: document.getElementById('ue-email').value,
            role: document.getElementById('ue-role').value,
            group_id: document.getElementById('ue-group').value ? parseInt(document.getElementById('ue-group').value) : null,
        });
        closeModal();
        showToast('Пользователь обновлён', 'success');
        handleRoute();
    };
}

async function deleteUser(id) {
    if (!confirm('Удалить пользователя?')) return;
    await apiDelete(`/users/${id}`);
    handleRoute();
}

// ── Categories CRUD ──
registerRoute('/categories', async () => {
    setupNavbar(getUser());
    setTopbarTitle('Категории');
    const categories = await apiGet('/categories/');
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="page-header flex-between">
            <div>
                <h1>Категории</h1>
                <p>Категоризация заданий</p>
            </div>
            <button class="btn btn-primary" onclick="showCategoryForm()">
                <span class="material-icons-round">add</span> Создать
            </button>
        </div>
        <div class="card card-elevated">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Название</th><th>Действия</th></tr></thead>
                    <tbody>
                        ${categories.length === 0 ? '<tr><td colspan="2" class="text-center text-muted" style="padding:32px">Нет категорий</td></tr>' :
                        categories.map(c => `<tr>
                            <td class="font-semibold">${c.name}</td>
                            <td>
                                <div class="btn-group">
                                    <button class="btn btn-icon-only btn-ghost" onclick="showCategoryForm(${c.id}, '${c.name}')"><span class="material-icons-round">edit</span></button>
                                    <button class="btn btn-icon-only btn-ghost" style="color:var(--red-500)" onclick="deleteCategory(${c.id})"><span class="material-icons-round">delete</span></button>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
});

async function showCategoryForm(id, name) {
    const html = `
        <form id="cat-form">
            <div class="form-group">
                <label class="form-label">Название</label>
                <input class="form-input" id="cf-name" value="${name || ''}" required placeholder="Название категории">
            </div>
            <button type="submit" class="btn btn-primary w-full">
                <span class="material-icons-round">${id ? 'save' : 'add'}</span> ${id ? 'Сохранить' : 'Создать'}
            </button>
        </form>`;
    showModal(id ? 'Редактировать категорию' : 'Новая категория', html);
    document.getElementById('cat-form').onsubmit = async (e) => {
        e.preventDefault();
        const body = { name: document.getElementById('cf-name').value };
        if (id) await apiPut(`/categories/${id}`, body);
        else await apiPost('/categories/', body);
        closeModal();
        showToast(id ? 'Категория обновлена' : 'Категория создана', 'success');
        handleRoute();
    };
}

async function deleteCategory(id) {
    if (!confirm('Удалить категорию?')) return;
    await apiDelete(`/categories/${id}`);
    handleRoute();
}
