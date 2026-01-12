"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token)
        return res.status(401).json({ error: 'Access token required' });
    try {
        const secret = process.env.JWT_SECRET || 'supersecret';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.user = decoded;
        next();
    }
    catch (error) {
        console.error('JWT Verification Error:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
exports.authenticateToken = authenticateToken;
