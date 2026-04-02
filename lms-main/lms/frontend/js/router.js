/* ── SPA Router ──────────────────────────────────── */
const routes = {};

function registerRoute(path, handler) {
    routes[path] = handler;
}

function navigateTo(path) {
    window.location.hash = path;
}

function getCurrentPath() {
    return window.location.hash.slice(1) || '/';
}

function matchRoute(path) {
    // Exact match first
    if (routes[path]) return { handler: routes[path], params: {} };

    // Pattern matching  e.g. /courses/:id
    for (const pattern of Object.keys(routes)) {
        const regex = pattern.replace(/:(\w+)/g, '(?<$1>[\\w-]+)');
        const match = path.match(new RegExp(`^${regex}$`));
        if (match) {
            return { handler: routes[pattern], params: match.groups || {} };
        }
    }
    return null;
}

async function handleRoute() {
    const path = getCurrentPath();
    const user = getUser();
    const token = getToken();

    // Auth guard
    if (!token && path !== '/login') {
        navigateTo('/login');
        return;
    }
    if (token && path === '/login') {
        navigateTo('/');
        return;
    }

    const matched = matchRoute(path);
    if (matched) {
        try {
            await matched.handler(matched.params);
        } catch (e) {
            console.error(e);
            document.getElementById('main-content').innerHTML = `
                <div class="card"><div class="alert alert-error">${e.message}</div></div>`;
        }
    } else {
        document.getElementById('main-content').innerHTML = `
            <div class="card text-center"><h2>404</h2><p>Страница не найдена</p></div>`;
    }
}

window.addEventListener('hashchange', handleRoute);
