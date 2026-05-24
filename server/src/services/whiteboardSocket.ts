import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

interface AuthedSocket extends Socket {
    userId?: string;
    role?: string;
    displayName?: string;
}

// Tracks pending saves per lesson so we don't write to DB on every keystroke
const saveTimers = new Map<string, NodeJS.Timeout>();
const SAVE_DEBOUNCE_MS = 1500;

function debouncedSave(lessonId: string, elements: any[]) {
    const existing = saveTimers.get(lessonId);
    if (existing) clearTimeout(existing);
    saveTimers.set(
        lessonId,
        setTimeout(async () => {
            try {
                await prisma.whiteboard.updateMany({
                    where: { lesson_id: lessonId },
                    data: { scene_data: { elements } },
                });
            } catch (err) {
                console.error('[WhiteboardSocket] Save failed:', err);
            } finally {
                saveTimers.delete(lessonId);
            }
        }, SAVE_DEBOUNCE_MS),
    );
}

async function userHasLessonAccess(userId: string, lessonId: string): Promise<boolean> {
    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
            tutor: { select: { user_id: true } },
            student: { select: { user_id: true } },
        },
    });
    if (!lesson) return false;
    return lesson.tutor.user_id === userId || lesson.student.user_id === userId;
}

export function initWhiteboardSocket(httpServer: HttpServer) {
    const io = new Server(httpServer, {
        cors: { origin: true, credentials: true },
        path: '/socket.io',
    });

    const whiteboard = io.of('/whiteboard');

    // JWT auth handshake
    whiteboard.use(async (socket: AuthedSocket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error('Missing auth token'));
            const secret = process.env.JWT_SECRET || 'supersecret';
            const decoded = jwt.verify(token, secret) as { id: string; role: string };
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    role: true,
                    is_suspended: true,
                    tutor_profile: { select: { username: true } },
                    student_profile: { select: { username: true } },
                },
            });
            if (!user || user.is_suspended) return next(new Error('Unauthorized'));
            socket.userId = user.id;
            socket.role = user.role;
            socket.displayName = user.tutor_profile?.username || user.student_profile?.username || 'User';
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    whiteboard.on('connection', (socket: AuthedSocket) => {
        socket.on('join', async ({ lessonId }: { lessonId: string }) => {
            if (!lessonId || !socket.userId) return;
            const ok = await userHasLessonAccess(socket.userId, lessonId);
            if (!ok) {
                socket.emit('error', { message: 'Access denied to this lesson' });
                return;
            }
            const room = `lesson:${lessonId}`;
            socket.join(room);
            socket.data.lessonId = lessonId;

            // Notify others & send current presence
            const sockets = await whiteboard.in(room).fetchSockets();
            const peers = sockets
                .filter((s) => s.id !== socket.id)
                .map((s) => ({ socketId: s.id, userId: (s as any).userId, name: (s as any).displayName, role: (s as any).role }));
            socket.emit('joined', { peers });
            socket.to(room).emit('peer:join', {
                socketId: socket.id,
                userId: socket.userId,
                name: socket.displayName,
                role: socket.role,
            });
        });

        // Full Excalidraw elements array — broadcast to peers AND persist (debounced)
        socket.on('scene:snapshot', ({ elements }: { elements: any[] }) => {
            const lessonId = socket.data.lessonId;
            if (!lessonId || !Array.isArray(elements)) return;
            socket.to(`lesson:${lessonId}`).emit('scene:snapshot', { elements, from: socket.id });
            debouncedSave(lessonId, elements);
        });

        socket.on('disconnect', () => {
            const lessonId = socket.data.lessonId;
            if (lessonId) {
                socket.to(`lesson:${lessonId}`).emit('peer:leave', { socketId: socket.id });
            }
        });
    });

    console.log('[WhiteboardSocket] Initialized at /socket.io (namespace /whiteboard)');
}
