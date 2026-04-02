/* ── Student Pages ────────────────────────────────── */

async function renderStudentCourses() {
    const courses = await apiGet('/courses/');
    const main = document.getElementById('main-content');

    main.innerHTML = `
        <div class="page-header">
            <h1>Мои курсы</h1>
            <p>Доступные курсы для обучения</p>
        </div>
        ${courses.length === 0 ? `
            <div class="empty-state">
                <span class="material-icons-round">school</span>
                <p>Вы пока не записаны ни на один курс</p>
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
                        <span class="badge badge-primary">Открыть</span>
                    </div>
                </div>
            `).join('')}
        </div>`}
    `;
}

async function renderStudentAssignment(a) {
    const main = document.getElementById('main-content');
    const now = new Date();
    const deadline = new Date(a.deadline);
    const isOverdue = now > deadline;

    let contentHtml = '';

    if (a.type === 'TEST') {
        const attempts = await apiGet(`/assignments/${a.id}/test-attempts`);
        const finished = attempts.find(att => att.finished_at);

        if (finished) {
            const pct = a.max_score > 0 ? Math.round((finished.score / a.max_score) * 100) : 0;
            contentHtml = `
                <div class="card card-elevated">
                    <div class="card-header">
                        <div class="card-title"><span class="material-icons-round" style="vertical-align:-4px;margin-right:8px;color:var(--emerald-500)">check_circle</span>Результат теста</div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-card emerald">
                            <div class="stat-icon emerald"><span class="material-icons-round">star</span></div>
                            <div class="stat-value">${finished.score}</div>
                            <div class="stat-label">Ваш балл</div>
                        </div>
                        <div class="stat-card purple">
                            <div class="stat-icon purple"><span class="material-icons-round">emoji_events</span></div>
                            <div class="stat-value">${a.max_score}</div>
                            <div class="stat-label">Максимум</div>
                        </div>
                    </div>
                    <div class="progress-bar-wrap mt-16" style="height:10px">
                        <div class="progress-bar-fill" style="width:${pct}%"></div>
                    </div>
                    <p class="text-sm text-muted mt-12"><span class="material-icons-round" style="font-size:14px;vertical-align:-2px">calendar_today</span> Сдан: ${formatDate(finished.finished_at)}</p>
                </div>`;
        } else {
            try {
                const test = await apiGet(`/assignments/${a.id}/test`);
                contentHtml = `
                    <div class="card card-elevated">
                        <div class="card-header">
                            <div class="card-title"><span class="material-icons-round" style="vertical-align:-4px;margin-right:8px;color:var(--primary-500)">quiz</span>Тест (${test.questions.length} вопросов)</div>
                        </div>
                        <form id="test-form">
                            ${test.questions.map((q, i) => `
                                <div class="question-card" data-qid="${q.id}">
                                    <div class="question-text"><span class="question-number">${i + 1}</span>${q.text} ${q.multiple ? '<span class="badge badge-info">Несколько ответов</span>' : ''}</div>
                                    ${q.image ? `<img src="${q.image}" class="question-image">` : ''}
                                    ${q.answers.map(ans => `
                                        <label class="answer-option" onclick="toggleAnswer(this, ${q.multiple})">
                                            <input type="${q.multiple ? 'checkbox' : 'radio'}" name="q_${q.id}" value="${ans.id}">
                                            <span class="${q.multiple ? 'answer-check' : 'answer-radio'}"></span>
                                            <span>${ans.text}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            `).join('')}
                            <button type="submit" class="btn btn-primary btn-lg w-full mt-24">
                                <span class="material-icons-round">send</span> Отправить ответы
                            </button>
                        </form>
                    </div>`;
            } catch (e) {
                contentHtml = `<div class="alert alert-error"><span class="material-icons-round">error</span> ${e.message}</div>`;
            }
        }
    } else {
        const subs = await apiGet(`/assignments/${a.id}/submissions`);
        const mySub = subs.find(s => s.student_id === getUser().id);

        contentHtml = `
            <div class="card card-elevated">
                <div class="card-header">
                    <div class="card-title"><span class="material-icons-round" style="vertical-align:-4px;margin-right:8px;color:var(--amber-500)">description</span>Задание с документом</div>
                </div>
                ${a.file_path ? `<div class="mb-16"><a href="${API_BASE}/assignments/${a.id}/download-task" target="_blank" class="btn btn-sm btn-ghost"><span class="material-icons-round">attach_file</span> Скачать файл задания</a></div>` : ''}
                ${mySub ? `
                    <div class="alert alert-success">
                        <span class="material-icons-round">check_circle</span>
                        <div>
                            Вы сдали задание ${formatDate(mySub.submitted_at)}
                            ${mySub.score !== null ? ` — Оценка: <strong>${mySub.score}</strong>` : ' — Ожидает проверки'}
                        </div>
                    </div>
                ` : `
                    <form id="doc-form">
                        <div class="form-group">
                            <label class="form-label">Загрузите файл с ответом</label>
                            <input type="file" id="doc-file" class="form-file-input">
                        </div>
                        <div id="doc-error"></div>
                        <button type="submit" class="btn btn-primary w-full" id="doc-submit-btn">
                            <span class="material-icons-round">upload</span> Отправить
                        </button>
                    </form>
                `}
            </div>`;
    }

    main.innerHTML = `
        <div class="page-header flex-between">
            <div>
                <h1>${a.title}</h1>
                <p>${a.description || ''}</p>
            </div>
            ${isOverdue ? '<span class="badge badge-danger badge-dot">Просрочено</span>' : '<span class="badge badge-success badge-dot">Активно</span>'}
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
        ${contentHtml}
    `;

    // Bind forms
    if (a.type === 'TEST') {
        const form = document.getElementById('test-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const answers = {};
                document.querySelectorAll('.question-card').forEach(qEl => {
                    const qid = parseInt(qEl.dataset.qid);
                    const checked = qEl.querySelectorAll('input:checked');
                    answers[qid] = Array.from(checked).map(c => parseInt(c.value));
                });
                try {
                    const result = await apiPost(`/assignments/${a.id}/submit-test`, { answers });
                    showToast(`Тест сдан! Ваш балл: ${result.score}`, 'success');
                    handleRoute();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            };
        }
    } else {
        const form = document.getElementById('doc-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const fileInput = document.getElementById('doc-file');
                const file = fileInput && fileInput.files[0];
                if (!file) {
                    document.getElementById('doc-error').innerHTML = '<div class="alert alert-error"><span class="material-icons-round">error</span> Выберите файл для отправки</div>';
                    return;
                }
                const btn = document.getElementById('doc-submit-btn');
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px"></span> Отправка...';
                try {
                    await apiUpload(`/assignments/${a.id}/submit-document`, file);
                    showToast('Задание отправлено!', 'success');
                    handleRoute();
                } catch (err) {
                    btn.disabled = false;
                    btn.innerHTML = '<span class="material-icons-round">upload</span> Отправить';
                    document.getElementById('doc-error').innerHTML = `<div class="alert alert-error"><span class="material-icons-round">error</span> ${err.message}</div>`;
                }
            };
        }
    }
}

function toggleAnswer(label, multiple) {
    if (!multiple) {
        const parent = label.closest('.question-card');
        parent.querySelectorAll('.answer-option').forEach(opt => opt.classList.remove('selected'));
    }
    label.classList.toggle('selected');
    const input = label.querySelector('input');
    if (!multiple) {
        input.checked = true;
    }
}

// ── My Grades ──
registerRoute('/my-grades', async () => {
    setupNavbar(getUser());
    setTopbarTitle('Мои оценки');
    const data = await apiGet('/dashboard/my-grades');
    const main = document.getElementById('main-content');

    main.innerHTML = `
        <div class="page-header">
            <h1>Мои оценки</h1>
            <p>Ваша успеваемость и результаты</p>
        </div>
        <div class="card card-elevated">
            <div class="card-header">
                <div class="card-title"><span class="material-icons-round" style="vertical-align:-4px;margin-right:8px;color:var(--amber-500)">description</span>Задания с документом</div>
            </div>
            ${data.submissions.length === 0 ? `
                <div class="empty-state" style="padding:24px">
                    <span class="material-icons-round">assignment</span>
                    <p>Вы пока не сдавали заданий</p>
                </div>` : `
            <div class="table-wrap">
            <table>
                <thead><tr><th>Задание</th><th>Оценка</th><th>Статус</th><th>Дата</th></tr></thead>
                <tbody>
                    ${data.submissions.map(s => `<tr>
                        <td><a href="#/assignments/${s.assignment_id}" class="font-semibold">#${s.assignment_id}</a></td>
                        <td>${s.score !== null ? `<span class="font-bold">${s.score}</span>` : '<span class="text-muted">—</span>'}</td>
                        <td>${statusBadge(s.status)}</td>
                        <td class="text-sm">${s.submitted_at ? formatDate(s.submitted_at) : '—'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            </div>`}
        </div>
        <div class="card card-elevated">
            <div class="card-header">
                <div class="card-title"><span class="material-icons-round" style="vertical-align:-4px;margin-right:8px;color:var(--sky-500)">quiz</span>Тесты</div>
            </div>
            ${data.test_attempts.length === 0 ? `
                <div class="empty-state" style="padding:24px">
                    <span class="material-icons-round">quiz</span>
                    <p>Вы пока не проходили тестов</p>
                </div>` : `
            <div class="table-wrap">
            <table>
                <thead><tr><th>Тест</th><th>Оценка</th><th>Дата</th></tr></thead>
                <tbody>
                    ${data.test_attempts.map(t => `<tr>
                        <td class="font-semibold">#${t.test_id}</td>
                        <td>${t.score !== null ? `<span class="font-bold">${t.score}</span>` : '<span class="text-muted">—</span>'}</td>
                        <td class="text-sm">${t.finished_at ? formatDate(t.finished_at) : '<span class="badge badge-warning badge-dot">В процессе</span>'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            </div>`}
        </div>
    `;
});
