"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../utils/auth");
const validation_1 = require("../utils/validation");
const register = async (req, res) => {
    try {
        const { email, password, role, username } = validation_1.RegisterSchema.parse(req.body);
        // Check if user exists
        const existingUser = await db_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        // Hash password
        const passwordHash = await (0, auth_1.hashPassword)(password);
        // Create User & Profile Transaction
        const result = await db_1.default.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email,
                    password_hash: passwordHash,
                    role,
                },
            });
            // Create specific profile based on role
            if (role === 'STUDENT') {
                await tx.studentProfile.create({
                    data: {
                        user_id: newUser.id,
                        username,
                    },
                });
            }
            else if (role === 'TUTOR') {
                await tx.tutorProfile.create({
                    data: {
                        user_id: newUser.id,
                        username,
                    },
                });
            }
            return newUser;
        });
        // Generate Token
        const token = (0, auth_1.generateToken)(result.id, result.role);
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: result.id, email: result.email, role: result.role, username }
        });
    }
    catch (error) {
        console.error('Registration Error:', error);
        res.status(400).json({ error: error.errors || 'Registration failed' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = validation_1.LoginSchema.parse(req.body);
        const user = await db_1.default.user.findUnique({
            where: { email },
            include: {
                student_profile: true,
                tutor_profile: true
            }
        });
        if (!user || !(await (0, auth_1.comparePassword)(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = (0, auth_1.generateToken)(user.id, user.role);
        const username = user.role === 'STUDENT' ? user.student_profile?.username : user.tutor_profile?.username;
        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email, role: user.role, username }
        });
    }
    catch (error) {
        res.status(400).json({ error: error.errors || 'Login failed' });
    }
};
exports.login = login;
