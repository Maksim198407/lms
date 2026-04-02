/* ── Auth Pages ──────────────────────────────────── */

registerRoute('/login', async () => {
    // Hide sidebar and topbar on login
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('main-wrapper').classList.remove('sidebar-open');
    document.getElementById('topbar').classList.add('hidden');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.remove();

    document.getElementById('main-content').innerHTML = `
    <div class="auth-page">
        <div class="auth-left">
            <h1>Учись. Развивайся.<br>Достигай целей.</h1>
            <p>Современная платформа для управления обучением. Создавайте курсы, назначайте задания и отслеживайте прогресс студентов.</p>
            <div class="auth-features">
                <div class="auth-feature">
                    <div class="auth-feature-icon"><span class="material-icons-round">auto_stories</span></div>
                    <span>Интерактивные курсы и темы</span>
                </div>
                <div class="auth-feature">
                    <div class="auth-feature-icon"><span class="material-icons-round">quiz</span></div>
                    <span>Тесты с автопроверкой</span>
                </div>
                <div class="auth-feature">
                    <div class="auth-feature-icon"><span class="material-icons-round">analytics</span></div>
                    <span>Детальная статистика и оценки</span>
                </div>
                <div class="auth-feature">
                    <div class="auth-feature-icon"><span class="material-icons-round">groups</span></div>
                    <span>Управление группами студентов</span>
                </div>
            </div>
        </div>
        <div class="auth-right">
            <div class="auth-card">
                <div class="auth-card-logo">
                    <div class="logo-icon"><span class="material-icons-round">school</span></div>
                    <span>LMS</span>
                </div>
                <h2>Добро пожаловать</h2>
                <p class="auth-subtitle">Войдите в свой аккаунт</p>
                <div id="auth-error"></div>
                <form id="login-form">
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input class="form-input" type="email" id="login-email" required placeholder="admin@lms.local">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Пароль</label>
                        <input class="form-input" type="password" id="login-password" required placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg w-full mt-8">
                        <span class="material-icons-round">login</span> Войти
                    </button>
                </form>
            </div>
        </div>
    </div>`;

    // Override main-content styles for auth page (full viewport)
    const mc = document.getElementById('main-content');
    mc.style.padding = '0';
    mc.style.maxWidth = 'none';

    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            const data = await apiPost('/auth/login', { email, password });
            setToken(data.access_token);
            const user = await apiGet('/auth/me');
            setUser(user);
            // Restore main-content styles
            mc.style.padding = '';
            mc.style.maxWidth = '';
            navigateTo('/');
        } catch (err) {
            document.getElementById('auth-error').innerHTML =
                `<div class="alert alert-error"><span class="material-icons-round">error</span> ${err.message}</div>`;
        }
    };
});

function logout() {
    clearToken();
    navigateTo('/login');
}

function setupNavbar(user) {
    // Restore main-content styles
    const mc = document.getElementById('main-content');
    mc.style.padding = '';
    mc.style.maxWidth = '';

    // Show sidebar and topbar
    const sidebar = document.getElementById('sidebar');
    const topbar = document.getElementById('topbar');
    const wrapper = document.getElementById('main-wrapper');
    sidebar.classList.remove('hidden');
    topbar.classList.remove('hidden');
    if (window.innerWidth > 1024) {
        wrapper.classList.add('sidebar-open');
    }

    // User info in sidebar footer
    document.getElementById('nav-user').textContent = user.name;
    document.getElementById('nav-role').textContent = user.role === 'ADMIN' ? 'Администратор' : 'Студент';
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

    // Build sidebar nav
    const links = document.getElementById('nav-links');
    if (user.role === 'ADMIN') {
        links.innerHTML = `
            <div class="nav-section-title">Основное</div>
            <a class="nav-item" href="#/" data-route="/">
                <span class="material-icons-round">dashboard</span> Панель управления
            </a>
            <a class="nav-item" href="#/courses" data-route="/courses">
                <span class="material-icons-round">auto_stories</span> Курсы
            </a>
            <div class="nav-section-title">Управление</div>
            <a class="nav-item" href="#/groups" data-route="/groups">
                <span class="material-icons-round">groups</span> Группы
            </a>
            <a class="nav-item" href="#/users" data-route="/users">
                <span class="material-icons-round">people</span> Пользователи
            </a>
            <a class="nav-item" href="#/categories" data-route="/categories">
                <span class="material-icons-round">category</span> Категории
            </a>
        `;
    } else {
        links.innerHTML = `
            <div class="nav-section-title">Обучение</div>
            <a class="nav-item" href="#/" data-route="/">
                <span class="material-icons-round">auto_stories</span> Мои курсы
            </a>
            <a class="nav-item" href="#/my-grades" data-route="/my-grades">
                <span class="material-icons-round">grade</span> Оценки
            </a>
        `;
    }

    // Highlight active
    highlightActiveNav();
    loadNotifications();
}

function highlightActiveNav() {
    const hash = window.location.hash.replace('#', '') || '/';
    document.querySelectorAll('.nav-item').forEach(item => {
        const route = item.dataset.route;
        item.classList.remove('active');
        if (route === hash || (route !== '/' && hash.startsWith(route))) {
            item.classList.add('active');
        }
    });
}

// Listen for hash changes to update nav active state
window.addEventListener('hashchange', highlightActiveNav);

async function loadNotifications() {
    try {
        const notifs = await apiGet('/dashboard/notifications');
        const unread = notifs.filter(n => !n.is_read).length;
        const badge = document.getElementById('notif-count');
        if (unread > 0) {
            badge.textContent = unread;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
        window._notifications = notifs;
    } catch (e) {}
}

function loadAndShowNotifications() {
    const notifs = window._notifications || [];
    showNotificationsModal(notifs);
}

function showNotificationsModal(notifs) {
    const html = notifs.length === 0
        ? `<div class="empty-state">
               <span class="material-icons-round">notifications_off</span>
               <p>Нет уведомлений</p>
           </div>`
        : `<div>${notifs.map(n => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}">
                <div class="flex-between">
                    <div class="notif-title">${n.title}</div>
                    ${!n.is_read ? `<button class="btn btn-sm btn-ghost" onclick="markNotifRead(${n.id}, this)">
                        <span class="material-icons-round" style="font-size:16px">done</span>
                    </button>` : ''}
                </div>
                <div class="notif-message">${n.message}</div>
                <div class="notif-time">${formatDate(n.created_at)}</div>
            </div>
        `).join('')}</div>`;

    showModal('Уведомления', html);
}

async function markNotifRead(id, btn) {
    await apiPut(`/dashboard/notifications/${id}/read`, {});
    btn.closest('.notif-item').classList.remove('unread');
    btn.remove();
    loadNotifications();
}
