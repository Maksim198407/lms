/* ── API helper ──────────────────────────────────── */
const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('lms_token');
}

function setToken(token) {
    localStorage.setItem('lms_token', token);
}

function clearToken() {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_user');
}

function getUser() {
    const u = localStorage.getItem('lms_user');
    return u ? JSON.parse(u) : null;
}

function setUser(user) {
    localStorage.setItem('lms_user', JSON.stringify(user));
}

async function api(path, options = {}) {
    const token = getToken();
    const headers = options.headers || {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const resp = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (resp.status === 401) {
        clearToken();
        navigateTo('/login');
        throw new Error('Unauthorized');
    }

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Ошибка сервера' }));
        throw new Error(err.detail || JSON.stringify(err));
    }

    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('json')) {
        return resp.json();
    }
    return resp;
}

function apiGet(path) {
    return api(path);
}

function apiPost(path, body) {
    return api(path, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

function apiPut(path, body) {
    return api(path, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

function apiDelete(path) {
    return api(path, { method: 'DELETE' });
}

function apiUpload(path, file) {
    const fd = new FormData();
    fd.append('file', file);
    return api(path, { method: 'POST', body: fd });
}
