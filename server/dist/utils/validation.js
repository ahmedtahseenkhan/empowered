"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginSchema = exports.RegisterSchema = void 0;
const zod_1 = require("zod");
exports.RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(['STUDENT', 'TUTOR']).default('STUDENT'),
    username: zod_1.z.string().min(2),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
