"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token)
        return res.status(401).json({ error: 'Access token required' });
    try {
        const secret = process.env.JWT_SECRET || 'supersecret';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        db_1.default.user
            .findUnique({ where: { id: decoded.id }, select: { id: true, role: true, is_suspended: true } })
            .then((user) => {
            if (!user)
                return res.status(401).json({ error: 'Unauthorized' });
            if (user.is_suspended)
                return res.status(403).json({ error: 'Account is suspended' });
            req.user = { id: user.id, role: user.role };
            return next();
        })
            .catch((err) => {
            console.error('Auth DB Lookup Error:', err);
            return res.status(500).json({ error: 'Server error' });
        });
    }
    catch (error) {
        console.error('JWT Verification Error:', error);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
exports.authenticateToken = authenticateToken;
/** Same as authenticateToken but does not 401 when no token; req.user is set only when valid token present. */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        return next();
    try {
        const secret = process.env.JWT_SECRET || 'supersecret';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        db_1.default.user
            .findUnique({ where: { id: decoded.id }, select: { id: true, role: true, is_suspended: true } })
            .then((user) => {
            if (!user || user.is_suspended)
                return next();
            req.user = { id: user.id, role: user.role };
            return next();
        })
            .catch(() => next());
    }
    catch {
        next();
    }
};
exports.optionalAuth = optionalAuth;
