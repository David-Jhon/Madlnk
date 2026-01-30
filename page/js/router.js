const routes = {
    'overview': { view: 'views/overview.html', script: null },
    'users': { view: 'views/users.html', script: 'js/users.js' },
    'analytics': { view: 'views/analytics.html', script: 'js/analytics.js' },
    'broadcast': { view: 'views/broadcast.html', script: 'js/broadcast.js' },
    'settings': { view: 'views/settings.html', script: 'js/settings.js' },
    'multibot': { view: 'views/multibot.html', script: null },
    'cron': { view: 'views/cron.html', script: 'js/cron.js' }
};

async function loadRoute(route) {
    const appContent = document.getElementById('app-content');
    const config = routes[route];

    if (!config || !config.view) {
        appContent.innerHTML = `
            <div class="glass rounded-2xl p-10 border border-gray-800 bg-gray-900/50 text-center">
                <h1 class="text-3xl font-bold text-white mb-4 capitalize">${route}</h1>
                <p class="text-gray-400">This section is coming soon.</p>
            </div>
        `;
        return;
    }

    try {
        // Load View
        const response = await fetch(config.view);

        if (response.redirected && response.url.includes('/login')) {
            window.location.href = '/login';
            return;
        }

        const html = await response.text();

        if (html.includes('id="login-form"') || html.includes('<title>Admin Login')) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) throw new Error('Failed to load view');

        appContent.innerHTML = html;

        if (config.script) {
            const scriptId = `route-script-${route}`;
            const existingScript = document.getElementById(scriptId);

            const initFunction = () => {
                if (route === 'users' && typeof window.initUsers === 'function') {
                    setTimeout(() => window.initUsers(), 0);
                } else if (route === 'analytics' && typeof window.initAnalytics === 'function') {
                    setTimeout(() => window.initAnalytics(), 0);
                } else if (route === 'settings' && typeof window.initSettings === 'function') {
                    setTimeout(() => window.initSettings(), 0);
                } else if (route === 'broadcast' && typeof window.initBroadcast === 'function') {
                    setTimeout(() => window.initBroadcast(), 0);
                } else if (route === 'cron' && typeof window.initCron === 'function') {
                    setTimeout(() => window.initCron(), 0);
                }
            };

            if (existingScript) {
                initFunction();
            } else {
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = config.script;
                script.onload = initFunction;
                document.body.appendChild(script);
            }
        }

        if (route === 'overview' && typeof window.fetchStats === 'function') {
            window.fetchStats();
        }
    } catch (error) {
        console.error('Error loading route:', error);
        appContent.innerHTML = '<p class="text-red-500">Error loading content.</p>';
    }
}

window.loadRoute = loadRoute;
