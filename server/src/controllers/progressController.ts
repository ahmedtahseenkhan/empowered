import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { HomeworkStatus } from '@prisma/client';

const ensureTutorStudentRelationship = async (tutorId: string, studentId: string) => {
    const existing = await prisma.lesson.findFirst({
        where: { tutor_id: tutorId, student_id: studentId },
        select: { id: true },
    });
    return !!existing;
};

const ensureStudentTutorRelationship = async (studentId: string, tutorId: string) => {
    const existing = await prisma.lesson.findFirst({
        where: { tutor_id: tutorId, student_id: studentId },
        select: { id: true },
    });
    return !!existing;
};

export const tutorGetStudentTimeline = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can view this timeline' });

        const studentId = (req.params.studentId as string | undefined)?.trim();
        if (!studentId) return res.status(400).json({ error: 'studentId is required' });

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId }, select: { id: true } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const ok = await ensureTutorStudentRelationship(tutor.id, studentId);
        if (!ok) return res.status(403).json({ error: 'No relationship with this student' });

        const [notes, tasks] = await Promise.all([
            prisma.progressNote.findMany({
                where: { tutor_id: tutor.id, student_id: studentId },
                orderBy: { created_at: 'desc' },
                take: 200,
                include: {
                    attachments: true,
                    student: { select: { username: true } },
                }
            }),
            prisma.homeworkTask.findMany({
                where: { tutor_id: tutor.id, student_id: studentId },
                orderBy: { created_at: 'desc' },
                take: 200,
                include: {
                    attachments: true,
                    submissions: {
                        orderBy: { created_at: 'desc' },
                        include: { attachments: true, student: { select: { username: true } } },
                    },
                    student: { select: { username: true } },
                }
            }),
        ]);

        const items: any[] = [];

        for (const n of notes) {
            items.push({
                type: 'NOTE',
                created_at: n.created_at,
                data: n,
            });
        }

        for (const t of tasks) {
            items.push({
                type: 'TASK',
                created_at: t.created_at,
                data: t,
            });

            for (const s of t.submissions) {
                items.push({
                    type: 'SUBMISSION',
                    created_at: s.created_at,
                    data: { ...s, task: { id: t.id, title: t.title, status: t.status } },
                });
            }
        }

        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return res.json({ studentId, items });
    } catch (e) {
        console.error('tutorGetStudentTimeline error:', e);
        return res.status(500).json({ error: 'Failed to load timeline' });
    }
};

export const tutorCreateNote = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can create notes' });

        const studentId = (req.params.studentId as string | undefined)?.trim();
        if (!studentId) return res.status(400).json({ error: 'studentId is required' });

        const body = (req.body?.body as string | undefined)?.trim();
        const visibilityRaw = (req.body?.visibility as string | undefined)?.trim();
        const attachments = (req.body?.attachments as any[] | undefined) || [];

        if (!body) return res.status(400).json({ error: 'body is required' });

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId }, select: { id: true } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const ok = await ensureTutorStudentRelationship(tutor.id, studentId);
        if (!ok) return res.status(403).json({ error: 'No relationship with this student' });

        const visibility = visibilityRaw === 'PRIVATE_TO_TUTOR' ? 'PRIVATE_TO_TUTOR' : 'SHARED_WITH_STUDENT';

        const created = await prisma.$transaction(async (tx) => {
            const note = await tx.progressNote.create({
                data: {
                    tutor_id: tutor.id,
                    student_id: studentId,
                    author_role: 'TUTOR',
                    visibility,
                    body,
                },
                include: { attachments: true }
            });

            if (attachments.length > 0) {
                await tx.attachment.createMany({
                    data: attachments.map((a: any) => ({
                        note_id: note.id,
                        file_url: String(a.file_url),
                        file_name: String(a.file_name || a.file_name === '' ? a.file_name : 'attachment'),
                        mime_type: String(a.mime_type || 'application/octet-stream'),
                        size: Number(a.size || 0),
                    }))
                });
            }

            const updated = await tx.progressNote.findUnique({ where: { id: note.id }, include: { attachments: true } });
            return updated;
        });

        return res.status(201).json({ note: created });
    } catch (e) {
        console.error('tutorCreateNote error:', e);
        return res.status(500).json({ error: 'Failed to create note' });
    }
};

export const tutorCreateTask = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can create homework tasks' });

        const studentId = (req.params.studentId as string | undefined)?.trim();
        if (!studentId) return res.status(400).json({ error: 'studentId is required' });

        const title = (req.body?.title as string | undefined)?.trim();
        const instructions = (req.body?.instructions as string | undefined)?.trim();
        const dueAtStr = (req.body?.due_at as string | undefined)?.trim();
        const attachments = (req.body?.attachments as any[] | undefined) || [];

        if (!title) return res.status(400).json({ error: 'title is required' });
        if (!instructions) return res.status(400).json({ error: 'instructions is required' });

        const due_at = dueAtStr ? new Date(dueAtStr) : null;
        if (dueAtStr && Number.isNaN(due_at?.getTime())) return res.status(400).json({ error: 'due_at is invalid' });

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId }, select: { id: true } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const ok = await ensureTutorStudentRelationship(tutor.id, studentId);
        if (!ok) return res.status(403).json({ error: 'No relationship with this student' });

        const created = await prisma.$transaction(async (tx) => {
            const task = await tx.homeworkTask.create({
                data: {
                    tutor_id: tutor.id,
                    student_id: studentId,
                    title,
                    instructions,
                    due_at: due_at || undefined,
                    status: 'ASSIGNED',
                },
                include: { attachments: true, submissions: true }
            });

            if (attachments.length > 0) {
                await tx.attachment.createMany({
                    data: attachments.map((a: any) => ({
                        task_id: task.id,
                        file_url: String(a.file_url),
                        file_name: String(a.file_name || a.file_name === '' ? a.file_name : 'attachment'),
                        mime_type: String(a.mime_type || 'application/octet-stream'),
                        size: Number(a.size || 0),
                    }))
                });
            }

            const updated = await tx.homeworkTask.findUnique({
                where: { id: task.id },
                include: {
                    attachments: true,
                    submissions: { orderBy: { created_at: 'desc' }, include: { attachments: true } }
                }
            });
            return updated;
        });

        return res.status(201).json({ task: created });
    } catch (e) {
        console.error('tutorCreateTask error:', e);
        return res.status(500).json({ error: 'Failed to create task' });
    }
};

export const tutorUpdateTaskStatus = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can update task status' });

        const taskId = (req.params.taskId as string | undefined)?.trim();
        if (!taskId) return res.status(400).json({ error: 'taskId is required' });

        const statusRaw = (req.body?.status as string | undefined)?.trim();
        const allowed = new Set<HomeworkStatus>(['ASSIGNED', 'SUBMITTED', 'REVIEWED', 'COMPLETED']);
        if (!statusRaw || !allowed.has(statusRaw as HomeworkStatus)) return res.status(400).json({ error: 'Invalid status' });
        const status = statusRaw as HomeworkStatus;

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId }, select: { id: true } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const existing = await prisma.homeworkTask.findUnique({ where: { id: taskId }, select: { tutor_id: true } });
        if (!existing) return res.status(404).json({ error: 'Task not found' });
        if (existing.tutor_id !== tutor.id) return res.status(403).json({ error: 'Not allowed' });

        const updated = await prisma.homeworkTask.update({ where: { id: taskId }, data: { status } });
        return res.json({ task: updated });
    } catch (e) {
        console.error('tutorUpdateTaskStatus error:', e);
        return res.status(500).json({ error: 'Failed to update task status' });
    }
};

export const tutorGetActivityFeed = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can view activity feed' });

        const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId }, select: { id: true } });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const limitRaw = (req.query.limit as string | undefined)?.trim();
        const limit = limitRaw ? Math.min(100, Math.max(1, parseInt(limitRaw, 10))) : 20;

        const [notes, tasks, submissions] = await Promise.all([
            prisma.progressNote.findMany({
                where: { tutor_id: tutor.id },
                orderBy: { created_at: 'desc' },
                take: limit,
                include: { student: { select: { id: true, username: true } } }
            }),
            prisma.homeworkTask.findMany({
                where: { tutor_id: tutor.id },
                orderBy: { created_at: 'desc' },
                take: limit,
                include: { student: { select: { id: true, username: true } } }
            }),
            prisma.homeworkSubmission.findMany({
                where: { task: { tutor_id: tutor.id } },
                orderBy: { created_at: 'desc' },
                take: limit,
                include: { student: { select: { id: true, username: true } }, task: { select: { id: true, title: true, status: true } } }
            }),
        ]);

        const items: any[] = [];

        for (const n of notes) {
            items.push({ type: 'NOTE', created_at: n.created_at, data: n });
        }
        for (const t of tasks) {
            items.push({ type: 'TASK', created_at: t.created_at, data: t });
        }
        for (const s of submissions) {
            items.push({ type: 'SUBMISSION', created_at: s.created_at, data: s });
        }

        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return res.json({ items: items.slice(0, limit) });
    } catch (e) {
        console.error('tutorGetActivityFeed error:', e);
        return res.status(500).json({ error: 'Failed to fetch activity feed' });
    }
};

export const studentGetTutorTimeline = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'STUDENT') return res.status(403).json({ error: 'Only students can view this timeline' });

        const tutorId = (req.params.tutorId as string | undefined)?.trim();
        if (!tutorId) return res.status(400).json({ error: 'tutorId is required' });

        const student = await prisma.studentProfile.findUnique({ where: { user_id: userId }, select: { id: true } });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const ok = await ensureStudentTutorRelationship(student.id, tutorId);
        if (!ok) return res.status(403).json({ error: 'No relationship with this tutor' });

        const [notes, tasks] = await Promise.all([
            prisma.progressNote.findMany({
                where: {
                    tutor_id: tutorId,
                    student_id: student.id,
                    OR: [{ visibility: 'SHARED_WITH_STUDENT' }, { author_role: 'STUDENT' }]
                },
                orderBy: { created_at: 'desc' },
                take: 200,
                include: { attachments: true }
            }),
            prisma.homeworkTask.findMany({
                where: { tutor_id: tutorId, student_id: student.id },
                orderBy: { created_at: 'desc' },
                take: 200,
                include: {
                    attachments: true,
                    submissions: {
                        where: { student_id: student.id },
                        orderBy: { created_at: 'desc' },
                        include: { attachments: true }
                    }
                }
            }),
        ]);

        const items: any[] = [];
        for (const n of notes) items.push({ type: 'NOTE', created_at: n.created_at, data: n });
        for (const t of tasks) {
            items.push({ type: 'TASK', created_at: t.created_at, data: t });
            for (const s of t.submissions) items.push({ type: 'SUBMISSION', created_at: s.created_at, data: { ...s, task: { id: t.id, title: t.title, status: t.status } } });
        }

        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return res.json({ tutorId, items });
    } catch (e) {
        console.error('studentGetTutorTimeline error:', e);
        return res.status(500).json({ error: 'Failed to load timeline' });
    }
};

export const studentCreateNote = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'STUDENT') return res.status(403).json({ error: 'Only students can create notes' });

        const tutorId = (req.params.tutorId as string | undefined)?.trim();
        if (!tutorId) return res.status(400).json({ error: 'tutorId is required' });

        const body = (req.body?.body as string | undefined)?.trim();
        const attachments = (req.body?.attachments as any[] | undefined) || [];

        if (!body) return res.status(400).json({ error: 'body is required' });

        const student = await prisma.studentProfile.findUnique({ where: { user_id: userId }, select: { id: true } });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const ok = await ensureStudentTutorRelationship(student.id, tutorId);
        if (!ok) return res.status(403).json({ error: 'No relationship with this tutor' });

        const created = await prisma.$transaction(async (tx) => {
            const note = await tx.progressNote.create({
                data: {
                    tutor_id: tutorId,
                    student_id: student.id,
                    author_role: 'STUDENT',
                    visibility: 'SHARED_WITH_STUDENT',
                    body,
                },
                include: { attachments: true }
            });

            if (attachments.length > 0) {
                await tx.attachment.createMany({
                    data: attachments.map((a: any) => ({
                        note_id: note.id,
                        file_url: String(a.file_url),
                        file_name: String(a.file_name || a.file_name === '' ? a.file_name : 'attachment'),
                        mime_type: String(a.mime_type || 'application/octet-stream'),
                        size: Number(a.size || 0),
                    }))
                });
            }

            const updated = await tx.progressNote.findUnique({ where: { id: note.id }, include: { attachments: true } });
            return updated;
        });

        return res.status(201).json({ note: created });
    } catch (e) {
        console.error('studentCreateNote error:', e);
        return res.status(500).json({ error: 'Failed to create note' });
    }
};

export const studentSubmitHomework = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'STUDENT') return res.status(403).json({ error: 'Only students can submit homework' });

        const taskId = (req.params.taskId as string | undefined)?.trim();
        if (!taskId) return res.status(400).json({ error: 'taskId is required' });

        const message = (req.body?.message as string | undefined)?.trim();
        const attachments = (req.body?.attachments as any[] | undefined) || [];

        const student = await prisma.studentProfile.findUnique({ where: { user_id: userId }, select: { id: true } });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const task = await prisma.homeworkTask.findUnique({ where: { id: taskId }, select: { id: true, tutor_id: true, student_id: true } });
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (task.student_id !== student.id) return res.status(403).json({ error: 'Not allowed' });

        const created = await prisma.$transaction(async (tx) => {
            const submission = await tx.homeworkSubmission.create({
                data: {
                    task_id: taskId,
                    student_id: student.id,
                    message: message || undefined,
                },
                include: { attachments: true }
            });

            if (attachments.length > 0) {
                await tx.attachment.createMany({
                    data: attachments.map((a: any) => ({
                        submission_id: submission.id,
                        file_url: String(a.file_url),
                        file_name: String(a.file_name || a.file_name === '' ? a.file_name : 'attachment'),
                        mime_type: String(a.mime_type || 'application/octet-stream'),
                        size: Number(a.size || 0),
                    }))
                });
            }

            await tx.homeworkTask.update({ where: { id: taskId }, data: { status: 'SUBMITTED' } });

            const updated = await tx.homeworkSubmission.findUnique({ where: { id: submission.id }, include: { attachments: true } });
            return updated;
        });

        return res.status(201).json({ submission: created });
    } catch (e) {
        console.error('studentSubmitHomework error:', e);
        return res.status(500).json({ error: 'Failed to submit homework' });
    }
};
