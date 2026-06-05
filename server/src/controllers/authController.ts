import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/db';
import { hashPassword, comparePassword, generateToken, generateVerificationToken, verifyToken } from '../utils/auth';
import { RegisterSchema, LoginSchema } from '../utils/validation';
import { AuthRequest } from '../middleware/authMiddleware';
import emailService from '../services/emailService';

const getClientBaseUrl = (): string => {
    const raw = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim();
    return raw.replace(/\/+$/, '');
};

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, role, username, tier } = RegisterSchema.parse(req.body);

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

        // Send Verification Code Email (6-digit code for inline wizard flow)
        try {
            const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
            const codeHash = await hashPassword(code);
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

            await prisma.emailVerificationCode.create({
                data: {
                    user_id: result.id,
                    code_hash: codeHash,
                    expires_at: expiresAt,
                },
            });

            await emailService.sendVerificationCodeEmail({
                username,
                email,
                code,
            });
        } catch (emailError) {
            console.error('Failed to send verification code email:', emailError);
        }

        res.status(201).json({
            message: 'User registered successfully. Please check your email to verify your account.',
            token,
            user: { id: result.id, email: result.email, role: result.role, username }
        });

    } catch (error: any) {
        console.error('Registration Error:', error);

        // Handle Zod validation errors
        if (error.errors) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors.map((e: any) => ({ path: e.path, message: e.message }))
            });
        }

        // Handle database or other errors
        res.status(500).json({
            error: 'Internal server error during registration',
            message: error.message || 'Registration failed'
        });
    }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') return res.status(400).json({ error: 'Invalid payload' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const ok = await comparePassword(currentPassword, user.password_hash);
        if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

        const nextHash = await hashPassword(newPassword);
        await prisma.user.update({ where: { id: userId }, data: { password_hash: nextHash } });

        return res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('changePassword error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const updateDisplayName = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { username } = req.body as { username?: string };
        if (!username || typeof username !== 'string' || !username.trim()) {
            return res.status(400).json({ error: 'username is required' });
        }
        const trimmed = username.trim();

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
        });
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        if (user.role === 'TUTOR') {
            await prisma.tutorProfile.update({ where: { user_id: userId }, data: { username: trimmed } });
        } else if (user.role === 'STUDENT') {
            await prisma.studentProfile.update({ where: { user_id: userId }, data: { username: trimmed } });
        } else if (user.role === 'ADMIN') {
            await prisma.adminProfile.update({ where: { user_id: userId }, data: { username: trimmed } });
        } else {
            return res.status(400).json({ error: 'Cannot update name for this role' });
        }

        return res.json({ message: 'Name updated successfully', username: trimmed });
    } catch (error) {
        console.error('updateDisplayName error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body as { email?: string };
        if (!email || typeof email !== 'string') return res.status(400).json({ error: 'email is required' });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.json({ message: 'If an account exists for that email, a reset code has been sent.' });
        }

        const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
        const codeHash = await hashPassword(code);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await prisma.passwordResetCode.create({
            data: {
                user_id: user.id,
                code_hash: codeHash,
                expires_at: expiresAt,
            },
        });

        const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.5">
              <h2>Password Reset Code</h2>
              <p>Your password reset code is:</p>
              <div style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</div>
              <p>This code expires in 15 minutes.</p>
              <p>If you did not request this, you can ignore this email.</p>
            </div>
        `;

        await emailService.sendEmail({
            to: email,
            subject: 'Your EmpowerEd password reset code',
            html,
        });

        return res.json({ message: 'If an account exists for that email, a reset code has been sent.' });
    } catch (error) {
        console.error('forgotPassword error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { email, code, newPassword } = req.body as { email?: string; code?: string; newPassword?: string };
        if (!email || !code || !newPassword) return res.status(400).json({ error: 'email, code, and newPassword are required' });
        if (typeof email !== 'string' || typeof code !== 'string' || typeof newPassword !== 'string') return res.status(400).json({ error: 'Invalid payload' });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(400).json({ error: 'Invalid code or email' });

        const latest = await prisma.passwordResetCode.findFirst({
            where: {
                user_id: user.id,
                used_at: null,
                expires_at: { gt: new Date() },
            },
            orderBy: { created_at: 'desc' },
        });

        if (!latest) return res.status(400).json({ error: 'Invalid or expired code' });

        const ok = await comparePassword(code, latest.code_hash);
        if (!ok) return res.status(400).json({ error: 'Invalid or expired code' });

        const nextHash = await hashPassword(newPassword);
        await prisma.$transaction([
            prisma.user.update({ where: { id: user.id }, data: { password_hash: nextHash } }),
            prisma.passwordResetCode.update({ where: { id: latest.id }, data: { used_at: new Date() } }),
        ]);

        return res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('resetPassword error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const me = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { tutor_profile: true, student_profile: true },
        });

        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        let userProfile: any = null;
        switch (user.role) {
            case 'STUDENT':
                userProfile = user.student_profile;
                break;
            case 'TUTOR':
                userProfile = user.tutor_profile;
                break;
            case 'ADMIN':
                const adminProfile = await prisma.adminProfile.findUnique({ where: { user_id: user.id } });
                userProfile = adminProfile;
                break;
        }

        return res.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                is_suspended: user.is_suspended,
                username: userProfile?.username,
                tier: (userProfile as any)?.tier,
                timezone: (userProfile as any)?.timezone,
                profile_photo: userProfile?.profile_photo,
                department: (userProfile as any)?.department,
                is_super_admin: (userProfile as any)?.is_super_admin ?? false,
                permissions: (userProfile as any)?.permissions ?? []
            },
        });
    } catch (error) {
        console.error('Auth Me Error:', error);
        return res.status(500).json({ error: 'Server error' });
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
        const tier = user.role === 'TUTOR' ? user.tutor_profile?.tier : undefined;
        const timezone = user.role === 'TUTOR' ? user.tutor_profile?.timezone : undefined;

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email, role: user.role, username, tier, timezone }
        });

    } catch (error: any) {
        res.status(400).json({ error: error.errors || 'Login failed' });
    }
};

export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token is required' });

        const decoded = verifyToken(token);
        if (!decoded || decoded.type !== 'email_verification') {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.is_verified) {
            return res.json({ message: 'Email already verified' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { is_verified: true }
        });

        return res.json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error('verifyEmail error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const resendVerification = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await prisma.user.findUnique({
            where: { email },
            include: { student_profile: true, tutor_profile: true }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.is_verified) return res.status(400).json({ error: 'Email already verified' });

        const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
        const codeHash = await hashPassword(code);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        await prisma.emailVerificationCode.create({
            data: {
                user_id: user.id,
                code_hash: codeHash,
                expires_at: expiresAt,
            },
        });

        const username = user.role === 'STUDENT' ? user.student_profile?.username : user.tutor_profile?.username;

        await emailService.sendVerificationCodeEmail({
            username: username || 'User',
            email: user.email,
            code,
        });

        return res.json({ message: 'Verification code sent' });
    } catch (error) {
        console.error('resendVerification error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const verifyEmailCode = async (req: Request, res: Response) => {
    try {
        const { email, code } = req.body as { email?: string; code?: string };
        if (!email || !code) return res.status(400).json({ error: 'email and code are required' });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(400).json({ error: 'Invalid email or code' });

        if (user.is_verified) {
            return res.json({ message: 'Email already verified' });
        }

        const latest = await prisma.emailVerificationCode.findFirst({
            where: {
                user_id: user.id,
                used_at: null,
                expires_at: { gt: new Date() },
            },
            orderBy: { created_at: 'desc' },
        });

        if (!latest) return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });

        const ok = await comparePassword(code, latest.code_hash);
        if (!ok) return res.status(400).json({ error: 'Invalid or expired code.' });

        await prisma.$transaction([
            prisma.user.update({ where: { id: user.id }, data: { is_verified: true } }),
            prisma.emailVerificationCode.update({ where: { id: latest.id }, data: { used_at: new Date() } }),
        ]);

        // Send welcome email now that email is confirmed
        try {
            const username = user.role === 'STUDENT'
                ? (await prisma.studentProfile.findUnique({ where: { user_id: user.id } }))?.username
                : (await prisma.tutorProfile.findUnique({ where: { user_id: user.id } }))?.username;
            const baseUrl = getClientBaseUrl();
            await emailService.sendWelcomeEmail({
                username: username || 'User',
                email: user.email,
                loginLink: `${baseUrl}/login`,
            });
        } catch (_e) { /* non-fatal */ }

        return res.json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error('verifyEmailCode error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};
