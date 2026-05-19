import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../config/db';

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
    const { title = 'Untitled Board', scene_data } = req.body;

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
            title,
            scene_data: scene_data ?? {},
        },
    });

    res.status(201).json(board);
};

export const updateWhiteboard = async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { title, scene_data } = req.body;

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
            ...(title !== undefined && { title }),
            ...(scene_data !== undefined && { scene_data }),
        },
    });

    res.json(updated);
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
