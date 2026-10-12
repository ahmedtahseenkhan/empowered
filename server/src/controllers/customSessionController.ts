import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { WalletError } from '../services/walletService';
import {
    cancelCustomSession,
    createOffer,
    listMentorStudents,
    publicCustomSessionRules,
    respondToOffer,
    withdrawOffer,
} from '../services/customSessionService';

const fail = (res: Response, e: unknown, fallback: string) => {
    if (e instanceof WalletError) return res.status(e.status).json({ error: e.message });
    console.error(`[CustomSession] ${fallback}:`, e);
    return res.status(500).json({ error: fallback });
};

const requireTutor = async (req: AuthRequest) => {
    if (!req.user?.id) throw new WalletError('Unauthorized', 401);
    if (req.user.role !== 'TUTOR') throw new WalletError('Only mentors can do this', 403);
    const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: req.user.id }, select: { id: true } });
    if (!tutor) throw new WalletError('Tutor profile not found', 404);
    return tutor;
};

const requireStudent = async (req: AuthRequest) => {
    if (!req.user?.id) throw new WalletError('Unauthorized', 401);
    if (req.user.role !== 'STUDENT') throw new WalletError('Only students can do this', 403);
    const student = await prisma.studentProfile.findUnique({ where: { user_id: req.user.id }, select: { id: true } });
    if (!student) throw new WalletError('Student profile not found', 404);
    return student;
};

const shape = (l: {
    id: string; status: string; start_time: Date; end_time: Date; duration: number;
    custom_kind: string | null; offer_message: string | null; offer_expires_at: Date | null;
    makeup_for_lesson_id: string | null; meeting_link: string | null;
    tutor: { username: string }; student: { username: string };
}) => ({
    id: l.id,
    status: l.status,
    start_time: l.start_time,
    end_time: l.end_time,
    duration: l.duration,
    custom_kind: l.custom_kind,
    offer_message: l.offer_message,
    offer_expires_at: l.offer_expires_at,
    makeup_for_lesson_id: l.makeup_for_lesson_id,
    meeting_link: l.meeting_link,
    tutor: { username: l.tutor.username },
    student: { username: l.student.username },
});

/** GET /api/custom-sessions/rules — limits the form needs (durations, notice, expiry). */
export const getCustomSessionRules = async (_req: AuthRequest, res: Response) => {
    return res.json(publicCustomSessionRules());
};

/** GET /api/custom-sessions/students — the mentor's own students only. */
export const getMyStudentsForScheduling = async (req: AuthRequest, res: Response) => {
    try {
        const tutor = await requireTutor(req);
        return res.json({ students: await listMentorStudents(tutor.id) });
    } catch (e) {
        return fail(res, e, 'Failed to load students');
    }
};

/** POST /api/custom-sessions — mentor offers a session to one of their students. */
export const createCustomSessionOffer = async (req: AuthRequest, res: Response) => {
    try {
        const tutor = await requireTutor(req);
        const body = (req.body || {}) as {
            studentId?: string; startTime?: string; durationMinutes?: number | string;
            kind?: string; makeupForLessonId?: string | null; message?: string | null;
        };
        if (!body.studentId) throw new WalletError('studentId is required');
        if (!body.startTime) throw new WalletError('startTime is required');

        const lesson = await createOffer({
            tutorId: tutor.id,
            studentId: String(body.studentId),
            startTime: new Date(body.startTime),
            durationMinutes: Number(body.durationMinutes),
            kind: String(body.kind || 'EXTRA').toUpperCase() as 'MAKEUP' | 'EXTRA',
            makeupForLessonId: body.makeupForLessonId || null,
            message: body.message || null,
        });
        return res.status(201).json({ lesson: shape(lesson) });
    } catch (e) {
        return fail(res, e, 'Failed to create the session offer');
    }
};

/** POST /api/custom-sessions/:lessonId/respond — student accepts or declines. */
export const respondToCustomSessionOffer = async (req: AuthRequest, res: Response) => {
    try {
        const student = await requireStudent(req);
        const action = String((req.body || {}).action || '').toLowerCase();
        if (action !== 'accept' && action !== 'decline') throw new WalletError('action must be accept or decline');
        const lesson = await respondToOffer({ lessonId: String(req.params.lessonId || ''), studentId: student.id, action });
        return res.json({ lesson: shape(lesson) });
    } catch (e) {
        return fail(res, e, 'Failed to respond to the offer');
    }
};

/** POST /api/custom-sessions/:lessonId/withdraw — mentor takes back an open offer. */
export const withdrawCustomSessionOffer = async (req: AuthRequest, res: Response) => {
    try {
        const tutor = await requireTutor(req);
        const lesson = await withdrawOffer({ lessonId: String(req.params.lessonId || ''), tutorId: tutor.id });
        return res.json({ lesson: shape(lesson) });
    } catch (e) {
        return fail(res, e, 'Failed to withdraw the offer');
    }
};

/** POST /api/custom-sessions/:lessonId/cancel — either side cancels a confirmed custom session. */
export const cancelCustomSessionHandler = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.id) throw new WalletError('Unauthorized', 401);
        const lessonId = String(req.params.lessonId || '');
        const lesson = req.user.role === 'TUTOR'
            ? await cancelCustomSession({ lessonId, actor: 'TUTOR', profileId: (await requireTutor(req)).id })
            : await cancelCustomSession({ lessonId, actor: 'STUDENT', profileId: (await requireStudent(req)).id });
        return res.json({ lesson: shape(lesson) });
    } catch (e) {
        return fail(res, e, 'Failed to cancel the session');
    }
};
