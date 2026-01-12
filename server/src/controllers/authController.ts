import { Request, Response } from 'express';
import prisma from '../config/db';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { RegisterSchema, LoginSchema } from '../utils/validation';

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, role, username, tier } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create User & Profile Transaction
        const result = await prisma.$transaction(async (tx) => {
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
            } else if (role === 'TUTOR') {
                await tx.tutorProfile.create({
                    data: {
                        user_id: newUser.id,
                        username,
                        tier: tier || 'STANDARD', // Save tier or default to STANDARD
                    },
                });
            }

            return newUser;
        });

        // Generate Token
        const token = generateToken(result.id, result.role);

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: result.id, email: result.email, role: result.role, username }
        });

    } catch (error: any) {
        console.error('Registration Error:', error);
        res.status(400).json({ error: error.errors || 'Registration failed' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = LoginSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                student_profile: true,
                tutor_profile: true
            }
        });

        if (!user || !(await comparePassword(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user.id, user.role);
        const username = user.role === 'STUDENT' ? user.student_profile?.username : user.tutor_profile?.username;

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email, role: user.role, username }
        });

    } catch (error: any) {
        res.status(400).json({ error: error.errors || 'Login failed' });
    }
};
