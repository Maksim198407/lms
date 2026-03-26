/* ── App Entry Point ─────────────────────────────── */

// ── Helpers ──
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function statusBadge(status) {
    const map = {
        'NOT_STARTED': ['Не начато', 'badge-muted'],
        'IN_PROGRESS': ['В процессе', 'badge-warning badge-dot'],
        'COMPLETED': ['Выполнено', 'badge-success badge-dot'],
        'OVERDUE': ['Просрочено', 'badge-danger badge-dot'],
    };
    const [label, cls] = map[status] || [status, 'badge-muted'];
    return `<span class="badge ${cls}">${label}</span>`;
}

function setTopbarTitle(title) {
    const el = document.getElementById('topbar-title');
    if (el) el.textContent = title;
}

// ── Sidebar Toggle ──
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const wrapper = document.getElementById('main-wrapper');
    const isMobile = window.innerWidth <= 1024;

    if (isMobile) {
        sidebar.classList.toggle('open');
        let overlay = document.querySelector('.sidebar-overlay');
        if (sidebar.classList.contains('open')) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'sidebar-overlay';
                overlay.onclick = () => toggleSidebar();
                document.body.appendChild(overlay);
            }
        } else {
            if (overlay) overlay.remove();
        }
    } else {
        sidebar.classList.toggle('hidden');
        wrapper.classList.toggle('sidebar-open');
    }
}

// ── Modal ──
function showModal(title, contentHtml) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title">${title}</div>
                <button class="modal-close" onclick="closeModal()">
                    <span class="material-icons-round">close</span>
                </button>
            </div>
            <div class="modal-body">${contentHtml}</div>
        </div>`;
    document.body.appendChild(overlay);
}

function closeModal() {
    const existing = document.getElementById('modal-overlay');
    if (existing) existing.remove();
}

// ── Toast ──
function showToast(message, type = '') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const icons = { success: 'check_circle', error: 'error' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icons[type] ? `<span class="material-icons-round">${icons[type]}</span>` : ''} ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ── Init ──
(async function init() {
    const token = getToken();
    if (token) {
        try {
            const user = await apiGet('/auth/me');
            setUser(user);
        } catch (e) {
            clearToken();
        }
    }
    if (!window.location.hash) {
        window.location.hash = getToken() ? '/' : '/login';
    }
    if (getToken() && window.innerWidth > 1024) {
        const sidebar = document.getElementById('sidebar');
        const wrapper = document.getElementById('main-wrapper');
        sidebar.classList.remove('hidden');
        wrapper.classList.add('sidebar-open');
    }
    handleRoute();
})();
