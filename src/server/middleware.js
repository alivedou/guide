import * as jose from 'jose';
import { DEBUG_MODE, secret } from './config.js';

export const authenticate = async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = { role: 'guest', id: 'guest' };
        return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
        req.user = { role: 'guest', id: 'guest' };
        return next();
    }

    try {
        const { payload } = await jose.jwtVerify(token, secret);
        req.user = payload;
        if (DEBUG_MODE) {
            console.log(`[Auth] Token valid: user=${payload.username}, id=${payload.id}, role=${payload.role}`);
        }
        next();
    } catch (err) {
        console.error('[Auth] Token verification FAILED:', err.message, err.code || '');
        req.user = { role: 'guest', id: 'guest' };
        next();
    }
};

export const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_user') {
        return res.status(403).json({ error: '权限不足，仅限管理员操作', code: 'FORBIDDEN' });
    }
    next();
};
