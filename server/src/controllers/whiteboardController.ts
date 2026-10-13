import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../config/db';

const MAX_SCENE_ELEMENTS = 5000;
const MAX_TITLE_CHARS = 200;

/** scene_data must be a plain object whose optional `elements`/`shapes` arrays hold at most MAX_SCENE_ELEMENTS objects. */
const validateScene = (scene: unknown): string | null => {
    if (scene === null || typeof scene !== 'object' || Array.isArray(scene)) return 'scene_data must be an object';
    for (const key of ['elements', 'shapes']) {
        const list = (scene as Record<string, unknown>)[key];
        if (list === undefined) continue;
        if (!Array.isArray(list)) return `scene_data.${key} must be an array`;
        if (list.length > MAX_SCENE_ELEMENTS) return `A board can hold at most ${MAX_SCENE_ELEMENTS} elements`;
        if (!list.every((el) => el !== null && typeof el === 'object' && !Array.isArray(el))) return `scene_data.${key} is invalid`;
    }
    return null;
};

// An empty title is allowed (saved as "Untitled Board") so clearing the title never blocks saving a drawing.
const validateTitle = (title: unknown): string | null =>
    title === undefined || title === null || (typeof title === 'string' && title.length <= MAX_TITLE_CHARS)
        ? null
        : `title must be at most ${MAX_TITLE_CHARS} characters`;

const normalizeTitle = (title: unknown): string =>
    typeof title === 'string' && title.trim() ? title.trim() : 'Untitled Board';

export const listWhiteboards = async (req: AuthRequest, res: Response): Promise<void> => {
    const tutorProfile = await prisma.tutorProfile.findUnique({
        where: { user_id: req.user!.id },
        select: { id: true },
    });

    if (!tutorProfile) {
        res.status(404).json({ error: 'Tutor profile not found' });
        return;
    }

    const boards = await prisma.whiteboard.findMany({
        where: { tutor_id: tutorProfile.id },
        select: { id: true, title: true, created_at: true, updated_at: true },
        orderBy: { updated_at: 'desc' },
    });

    res.json(boards);
};

export const getWhiteboard = async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const tutorProfile = await prisma.tutorProfile.findUnique({
        where: { user_id: req.user!.id },
        select: { id: true },
    });

    if (!tutorProfile) {
        res.status(404).json({ error: 'Tutor profile not found' });
        return;
    }

    const board = await prisma.whiteboard.findFirst({
        where: { id, tutor_id: tutorProfile.id },
    });

    if (!board) {
        res.status(404).json({ error: 'Whiteboard not found' });
        return;
    }

    res.json(board);
};

export const createWhiteboard = async (req: AuthRequest, res: Response): Promise<void> => {
    const { title = 'Untitled Board', scene_data } = req.body ?? {};
    const invalid = validateTitle(title) || (scene_data !== undefined && scene_data !== null ? validateScene(scene_data) : null);
    if (invalid) {
        res.status(400).json({ error: invalid });
        return;
    }

    const tutorProfile = await prisma.tutorProfile.findUnique({
        where: { user_id: req.user!.id },
        select: { id: true },
    });

    if (!tutorProfile) {
        res.status(404).json({ error: 'Tutor profile not found' });
        return;
    }

    const board = await prisma.whiteboard.create({
        data: {
            tutor_id: tutorProfile.id,
            title: normalizeTitle(title),
            scene_data: scene_data ?? {},
        },
    });

    res.status(201).json(board);
};

export const updateWhiteboard = async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { title, scene_data } = req.body ?? {};
    const invalid = (title !== undefined ? validateTitle(title) : null) || (scene_data !== undefined ? validateScene(scene_data) : null);
    if (invalid) {
        res.status(400).json({ error: invalid });
        return;
    }

    const tutorProfile = await prisma.tutorProfile.findUnique({
        where: { user_id: req.user!.id },
        select: { id: true },
    });

    if (!tutorProfile) {
        res.status(404).json({ error: 'Tutor profile not found' });
        return;
    }

    const board = await prisma.whiteboard.findFirst({
        where: { id, tutor_id: tutorProfile.id },
    });

    if (!board) {
        res.status(404).json({ error: 'Whiteboard not found' });
        return;
    }

    const updated = await prisma.whiteboard.update({
        where: { id },
        data: {
            ...(title !== undefined && title !== null && { title: normalizeTitle(title) }),
            ...(scene_data !== undefined && { scene_data }),
        },
    });

    res.json(updated);
};

/**
 * Get-or-create the whiteboard for a specific lesson. Accessible by either the
 * lesson's tutor or its student. Used by the live collaborative whiteboard mode.
 */
export const getOrCreateLessonWhiteboard = async (req: AuthRequest, res: Response): Promise<void> => {
    const { lessonId } = req.params;
    const userId = req.user!.id;

    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
            tutor: { select: { id: true, user_id: true, username: true } },
            student: { select: { id: true, user_id: true, username: true } },
        },
    });

    if (!lesson) {
        res.status(404).json({ error: 'Lesson not found' });
        return;
    }

    const isTutor = lesson.tutor.user_id === userId;
    const isStudent = lesson.student.user_id === userId;
    if (!isTutor && !isStudent) {
        res.status(403).json({ error: 'You are not part of this lesson' });
        return;
    }

    let board = await prisma.whiteboard.findUnique({ where: { lesson_id: lessonId } });
    if (!board) {
        board = await prisma.whiteboard.create({
            data: {
                tutor_id: lesson.tutor.id,
                lesson_id: lessonId,
                title: `Session with ${lesson.student.username || lesson.tutor.username}`,
                scene_data: { shapes: [] },
            },
        });
    }

    res.json({
        board,
        lesson: {
            id: lesson.id,
            tutor_name: lesson.tutor.username,
            student_name: lesson.student.username,
            start_time: lesson.start_time,
            end_time: lesson.end_time,
        },
        role: isTutor ? 'tutor' : 'student',
    });
};

export const deleteWhiteboard = async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const tutorProfile = await prisma.tutorProfile.findUnique({
        where: { user_id: req.user!.id },
        select: { id: true },
    });

    if (!tutorProfile) {
        res.status(404).json({ error: 'Tutor profile not found' });
        return;
    }

    const board = await prisma.whiteboard.findFirst({
        where: { id, tutor_id: tutorProfile.id },
    });

    if (!board) {
        res.status(404).json({ error: 'Whiteboard not found' });
        return;
    }

    await prisma.whiteboard.delete({ where: { id } });
    res.json({ success: true });
};
