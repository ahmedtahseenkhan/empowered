import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { hashPassword, comparePassword, compareDummyPassword, generateToken, generateNumericCode, verifyAccessToken } from '../utils/auth';
import { RegisterSchema, LoginSchema, PasswordSchema, normalizeEmail, firstIssue } from '../utils/validation';
import { AuthRequest } from '../middleware/authMiddleware';
import { getAppClient, getTokenFromRequest, setAuthCookie, clearAuthCookie } from '../utils/authCookie';
import emailService from '../services/emailService';
import { ensureBetaPremiumAccess, isApprovedBetaEmail } from '../services/betaService';

const getClientBaseUrl = (): string => {
    const raw = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim();
    return raw.replace(/\/+$/, '');
};

/** Wrong guesses allowed per emailed code before it is burned and a new one must be requested. */
const MAX_CODE_ATTEMPTS = 5;
const VERIFICATION_CODE_TTL_MS = 30 * 60 * 1000;
const RESET_CODE_TTL_MS = 15 * 60 * 1000;

const RESET_REQUESTED_MESSAGE = 'If an account exists for that email, a reset code has been sent.';
const INVALID_CODE_MESSAGE = 'Invalid or expired code. Request a new one if needed.';

/** Accounts are matched case-insensitively (older accounts may have mixed-case emails stored). */
const findUserByEmail = (email: string) =>
    prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });

/** Run work after the response has been sent, so response time doesn't reveal whether an account exists. */
const runInBackground = (label: string, work: () => Promise<void>) => {
    setImmediate(() => {
        work().catch((err) => console.error(`${label} error:`, err));
    });
};

/**
 * Burn every outstanding code for the user and issue a fresh one. A pending password (from someone
 * signing up again with an unverified email) only takes effect if this code is verified, i.e. by
 * whoever controls the inbox — so a stranger who registered the address first can't keep access.
 */
const issueVerificationCode = async (userId: string, pendingPasswordHash?: string): Promise<string> => {
    const code = generateNumericCode();
    const codeHash = await hashPassword(code);
    await prisma.$transaction([
        prisma.emailVerificationCode.updateMany({ where: { user_id: userId, used_at: null }, data: { used_at: new Date() } }),
        prisma.emailVerificationCode.create({
            data: {
                user_id: userId,
                code_hash: codeHash,
                expires_at: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
                pending_password_hash: pendingPasswordHash ?? null,
            },
        }),
    ]);
    return code;
};

const getUsername = async (userId: string, role: string): Promise<string | undefined> => {
    if (role === 'STUDENT') return (await prisma.studentProfile.findUnique({ where: { user_id: userId }, select: { username: true } }))?.username;
    if (role === 'TUTOR') return (await prisma.tutorProfile.findUnique({ where: { user_id: userId }, select: { username: true } }))?.username;
    if (role === 'ADMIN') return (await prisma.adminProfile.findUnique({ where: { user_id: userId }, select: { username: true } }))?.username;
    return undefined;
};

const sendAccountExistsNotice = async (email: string) => {
    const baseUrl = getClientBaseUrl();
    await emailService.sendEmail({
        to: email,
        subject: 'Someone tried to sign up with your EmpowerEd email',
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5">
              <h2>You already have an account</h2>
              <p>Someone (hopefully you) tried to create a new EmpowerEd Learnings account with this email address.</p>
              <p>You can <a href="${baseUrl}/login">sign in here</a>, or use "Forgot password" if you can't remember your password.</p>
              <p>If this wasn't you, you can ignore this email — your account is unchanged.</p>
            </div>
        `,
    });
};

const sendPasswordChangedNotice = async (email: string) => {
    await emailService.sendEmail({
        to: email,
        subject: 'Your EmpowerEd password was changed',
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5">
              <h2>Password changed</h2>
              <p>The password for your EmpowerEd Learnings account was just changed, and all other sessions were signed out.</p>
              <p>If you didn't do this, reset your password right away using "Forgot password" and contact support.</p>
            </div>
        `,
    });
};

/**
 * Same response whether or not the email is already registered, so signup can't be used to
 * discover accounts. An existing owner gets an email instead (or a fresh code if unverified).
 */
export const register = async (req: Request, res: Response) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: firstIssue(parsed.error),
            details: parsed.error.issues.map((e) => ({ path: e.path, message: e.message })),
        });
    }
    const { email, password, role, username } = parsed.data;

    try {
        const isBeta = role === 'TUTOR' ? await isApprovedBetaEmail(email).catch(() => false) : false;
        const accepted = {
            message: 'User registered successfully. Please check your email for a verification code.',
            requiresVerification: true,
            email,
            role,
            is_beta: isBeta,
        };

        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            runInBackground('register(existing)', async () => {
                if (existingUser.is_verified) {
                    await sendAccountExistsNotice(existingUser.email);
                } else {
                    const code = await issueVerificationCode(existingUser.id, await hashPassword(password));
                    await emailService.sendVerificationCodeEmail({
                        username: (await getUsername(existingUser.id, existingUser.role)) || 'User',
                        email: existingUser.email,
                        code,
                    });
                }
            });
            return res.status(201).json(accepted);
        }

        const passwordHash = await hashPassword(password);

        const newUser = await prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: { email, password_hash: passwordHash, role },
            });

            if (role === 'STUDENT') {
                await tx.studentProfile.create({ data: { user_id: created.id, username } });
            } else if (role === 'TUTOR') {
                // NOTE: never trust a client-supplied tier here. Tier must reflect a real
                // paid subscription (set by the Stripe webhook) or an approved beta trial.
                // New mentors start on the default tier with no active subscription.
                await tx.tutorProfile.create({ data: { user_id: created.id, username } });
            }
            return created;
        });

        try {
            const code = await issueVerificationCode(newUser.id);
            await emailService.sendVerificationCodeEmail({ username, email, code });
        } catch (emailError) {
            console.error('Failed to send verification code email:', emailError);
        }

        // NOTE: no session is issued here. Access is granted only after the email is
        // verified via /auth/verify-email-code. This applies to every role.
        return res.status(201).json(accepted);
    } catch (error) {
        console.error('Registration Error:', error);
        return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
};

const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1).max(256),
    newPassword: PasswordSchema,
});

export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const parsed = ChangePasswordSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
        const { currentPassword, newPassword } = parsed.data;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const ok = await comparePassword(currentPassword, user.password_hash);
        if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

        const nextHash = await hashPassword(newPassword);
        // Bumping token_version signs out every other session; this one gets a fresh cookie.
        const updated = await prisma.user.update({
            where: { id: userId },
            data: { password_hash: nextHash, token_version: { increment: 1 } },
            select: { id: true, role: true, email: true, token_version: true },
        });
        setAuthCookie(res, getAppClient(req), generateToken(updated.id, updated.role, updated.token_version));

        runInBackground('changePassword notice', () => sendPasswordChangedNotice(updated.email));
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
        if (trimmed.length > 80) return res.status(400).json({ error: 'username must be at most 80 characters' });

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
    const email = normalizeEmail((req.body as { email?: unknown })?.email);
    if (!email) return res.status(400).json({ error: 'A valid email is required' });

    // Respond first: the lookup, hashing and sending happen afterwards so timing is identical
    // for registered and unregistered addresses.
    res.json({ message: RESET_REQUESTED_MESSAGE });

    runInBackground('forgotPassword', async () => {
        const user = await findUserByEmail(email);
        if (!user || user.is_suspended) return;

        const code = generateNumericCode();
        const codeHash = await hashPassword(code);
        await prisma.$transaction([
            prisma.passwordResetCode.updateMany({ where: { user_id: user.id, used_at: null }, data: { used_at: new Date() } }),
            prisma.passwordResetCode.create({
                data: { user_id: user.id, code_hash: codeHash, expires_at: new Date(Date.now() + RESET_CODE_TTL_MS) },
            }),
        ]);

        await emailService.sendEmail({
            to: user.email,
            subject: 'Your EmpowerEd password reset code',
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.5">
                  <h2>Password Reset Code</h2>
                  <p>Your password reset code is:</p>
                  <div style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</div>
                  <p>This code expires in 15 minutes.</p>
                  <p>If you did not request this, you can ignore this email.</p>
                </div>
            `,
        });
    });
};

const ResetPasswordSchema = z.object({
    email: z.string(),
    code: z.string().trim().regex(/^\d{6}$/),
    newPassword: PasswordSchema,
});

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const parsed = ResetPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            const passwordIssue = parsed.error.issues.find((i) => i.path[0] === 'newPassword');
            return res.status(400).json({ error: passwordIssue ? passwordIssue.message : INVALID_CODE_MESSAGE });
        }
        const email = normalizeEmail(parsed.data.email);
        if (!email) return res.status(400).json({ error: INVALID_CODE_MESSAGE });

        const user = await findUserByEmail(email);
        if (!user) {
            await compareDummyPassword(parsed.data.code);
            return res.status(400).json({ error: INVALID_CODE_MESSAGE });
        }

        const latest = await prisma.passwordResetCode.findFirst({
            where: { user_id: user.id, used_at: null, expires_at: { gt: new Date() } },
            orderBy: { created_at: 'desc' },
        });
        if (!latest) return res.status(400).json({ error: INVALID_CODE_MESSAGE });

        const ok = await comparePassword(parsed.data.code, latest.code_hash);
        if (!ok) {
            const attempts = latest.attempts + 1;
            await prisma.passwordResetCode.update({
                where: { id: latest.id },
                data: { attempts, ...(attempts >= MAX_CODE_ATTEMPTS ? { used_at: new Date() } : {}) },
            });
            return res.status(400).json({ error: INVALID_CODE_MESSAGE });
        }

        const nextHash = await hashPassword(parsed.data.newPassword);
        await prisma.$transaction([
            // Signs out every existing session (including a stolen one).
            prisma.user.update({ where: { id: user.id }, data: { password_hash: nextHash, token_version: { increment: 1 } } }),
            prisma.passwordResetCode.updateMany({ where: { user_id: user.id, used_at: null }, data: { used_at: new Date() } }),
        ]);

        runInBackground('resetPassword notice', () => sendPasswordChangedNotice(user.email));
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
                is_beta: (userProfile as any)?.is_beta ?? false,
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
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Please enter a valid email and password' });
        const { email, password } = parsed.data;

        const found = await findUserByEmail(email);
        if (!found) {
            await compareDummyPassword(password);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!(await comparePassword(password, found.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = await prisma.user.findUniqueOrThrow({
            where: { id: found.id },
            include: { student_profile: true, tutor_profile: true },
        });

        // Block sign-in until the email address has been verified.
        if (!user.is_verified) {
            return res.status(403).json({
                error: 'Please verify your email address before signing in. Check your inbox for the verification code.',
                code: 'EMAIL_NOT_VERIFIED',
                email: user.email,
            });
        }

        // Suspended accounts cannot sign in (middleware also blocks them per-request).
        if (user.is_suspended) {
            return res.status(403).json({
                error: 'Your account has been suspended. Please contact support.',
                code: 'ACCOUNT_SUSPENDED',
            });
        }

        const client = getAppClient(req);
        if (client === 'admin' && user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied: Admin privileges required.' });
        }

        setAuthCookie(res, client, generateToken(user.id, user.role, user.token_version));

        const username = user.role === 'STUDENT' ? user.student_profile?.username : user.tutor_profile?.username;
        let tier = user.role === 'TUTOR' ? user.tutor_profile?.tier : undefined;
        let isBeta = user.role === 'TUTOR' ? (user.tutor_profile?.is_beta ?? false) : undefined;
        const timezone = user.role === 'TUTOR' ? user.tutor_profile?.timezone : undefined;

        // Approved beta mentors who signed up before auto-assignment existed (or abandoned the old
        // plan step) get their Premium beta plan here, so they land straight on the dashboard.
        if (user.role === 'TUTOR' && user.tutor_profile && !user.tutor_profile.is_beta) {
            const beta = await ensureBetaPremiumAccess(user.id).catch(() => null);
            if (beta) {
                tier = beta.tier;
                isBeta = beta.is_beta;
            }
        }

        return res.json({
            message: 'Login successful',
            user: { id: user.id, email: user.email, role: user.role, username, tier, is_beta: isBeta, timezone }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Login failed' });
    }
};

/** Ends this session only: its id is revoked server-side, so a copied cookie stops working too. */
export const logout = async (req: Request, res: Response) => {
    const token = getTokenFromRequest(req);
    const decoded = token ? verifyAccessToken(token) : null;
    if (decoded) {
        try {
            const expiresAt = new Date(decoded.exp * 1000);
            await prisma.revokedSession.upsert({
                where: { sid: decoded.sid },
                create: { sid: decoded.sid, expires_at: expiresAt },
                update: {},
            });
            await prisma.revokedSession.deleteMany({ where: { expires_at: { lt: new Date() } } });
        } catch (error) {
            console.error('logout error:', error);
        }
    }
    clearAuthCookie(res, getAppClient(req));
    return res.json({ message: 'Logged out' });
};

export const resendVerification = async (req: Request, res: Response) => {
    const email = normalizeEmail((req.body as { email?: unknown })?.email);
    if (!email) return res.status(400).json({ error: 'A valid email is required' });

    res.json({ message: 'If this account still needs verification, a new code has been sent.' });

    runInBackground('resendVerification', async () => {
        const user = await findUserByEmail(email);
        if (!user || user.is_verified) return;
        const code = await issueVerificationCode(user.id);
        await emailService.sendVerificationCodeEmail({
            username: (await getUsername(user.id, user.role)) || 'User',
            email: user.email,
            code,
        });
    });
};

export const verifyEmailCode = async (req: Request, res: Response) => {
    try {
        const email = normalizeEmail((req.body as { email?: unknown })?.email);
        const code = (req.body as { code?: unknown })?.code;
        if (!email || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
            return res.status(400).json({ error: INVALID_CODE_MESSAGE });
        }

        const user = await findUserByEmail(email);
        if (!user || user.is_verified) {
            // Already-verified accounts must sign in with their password; a code never grants a session here.
            if (!user) await compareDummyPassword(code);
            return res.status(400).json({ error: INVALID_CODE_MESSAGE });
        }

        const latest = await prisma.emailVerificationCode.findFirst({
            where: { user_id: user.id, used_at: null, expires_at: { gt: new Date() } },
            orderBy: { created_at: 'desc' },
        });
        if (!latest) return res.status(400).json({ error: INVALID_CODE_MESSAGE });

        const ok = await comparePassword(code.trim(), latest.code_hash);
        if (!ok) {
            const attempts = latest.attempts + 1;
            await prisma.emailVerificationCode.update({
                where: { id: latest.id },
                data: { attempts, ...(attempts >= MAX_CODE_ATTEMPTS ? { used_at: new Date() } : {}) },
            });
            return res.status(400).json({ error: INVALID_CODE_MESSAGE });
        }

        const verified = await prisma.$transaction(async (tx) => {
            await tx.emailVerificationCode.updateMany({ where: { user_id: user.id, used_at: null }, data: { used_at: new Date() } });
            return tx.user.update({
                where: { id: user.id },
                data: {
                    is_verified: true,
                    ...(latest.pending_password_hash
                        ? { password_hash: latest.pending_password_hash, token_version: { increment: 1 } }
                        : {}),
                },
                select: { token_version: true },
            });
        });

        const username = await getUsername(user.id, user.role);
        runInBackground('welcome email', async () => {
            const baseUrl = getClientBaseUrl();
            await emailService.sendWelcomeEmail({
                username: username || 'User',
                email: user.email,
                role: user.role,
                loginLink: `${baseUrl}/login`,
                dashboardUrl: `${baseUrl}/dashboard`,
            });
        });

        // Approved beta mentors get the Premium beta plan assigned automatically — they never
        // see the plan/payment step and go straight to the dashboard.
        const beta = user.role === 'TUTOR' ? await ensureBetaPremiumAccess(user.id).catch(() => null) : null;

        if (user.is_suspended) return res.json({ message: 'Email verified successfully' });

        // The session starts only now that the email is verified.
        setAuthCookie(res, getAppClient(req), generateToken(user.id, user.role, verified.token_version));
        return res.json({
            message: 'Email verified successfully',
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                username,
                tier: beta?.tier,
                is_beta: beta?.is_beta ?? false,
            },
        });
    } catch (error) {
        console.error('verifyEmailCode error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};
