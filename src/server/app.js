import express from 'express';
import path from 'path';
import { ROOT_DIR } from './config.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAnnouncementRoutes } from './routes/announcements.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerConfigRoutes } from './routes/config.js';

export function createApp() {
    const app = express();
    app.use(express.json({ limit: '10mb' }));

    registerPublicRoutes(app);
    registerAuthRoutes(app);
    registerAdminRoutes(app);
    registerAnnouncementRoutes(app);
    registerProfileRoutes(app);
    registerConfigRoutes(app);

    app.use(express.static(path.join(ROOT_DIR, 'nav-main/public')));
    app.get('*', (req, res) => res.sendFile(path.join(ROOT_DIR, 'nav-main/public/index.html')));
    return app;
}

export function listMountedRoutes(app) {
    const routes = [];
    const stack = app._router?.stack || [];
    for (const layer of stack) {
        if (!layer.route) continue;
        const routePath = layer.route.path;
        for (const method of Object.keys(layer.route.methods)) {
            if (method === 'head') continue;
            if (!layer.route.methods[method]) continue;
            routes.push({ method: method.toUpperCase(), path: routePath });
        }
    }
    return routes;
}
