import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import prisma from '../config/db';
import { verifyAccessToken } from '../utils/auth';
import { getAllTokensFromCookieHeader } from '../utils/authCookie';
import { isOriginAllowed } from '../config/origins';

interface AuthedSocket extends Socket {
    userId?: string;
    role?: string;
    displayName?: string;
}

// Tracks pending saves per lesson so we don't write to DB on every keystroke
const saveTimers = new Map<string, NodeJS.Timeout>();
const SAVE_DEBOUNCE_MS = 1500;
// Caps on what one client can push into a room and the database
const MAX_SCENE_ELEMENTS = 5000;
const MAX_SNAPSHOTS_PER_10S = 50;

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
        cors: { origin: (origin, cb) => cb(null, isOriginAllowed(origin)), credentials: true },
        path: '/socket.io',
        maxHttpBufferSize: 2 * 1024 * 1024,
        // Reject cross-site WebSocket handshakes (CORS does not cover WebSockets)
        allowRequest: (req, cb) => cb(null, isOriginAllowed(req.headers.origin)),
    });

    const whiteboard = io.of('/whiteboard');

    // Session-cookie auth handshake (the HttpOnly cookie is sent with the upgrade request)
    whiteboard.use(async (socket: AuthedSocket, next) => {
        try {
            // Main-site session first: the whiteboard lives in the main app
            const decoded = getAllTokensFromCookieHeader(socket.handshake.headers.cookie).reverse()
                .map(verifyAccessToken)
                .find((d) => d !== null);
            if (!decoded) return next(new Error('Unauthorized'));
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    role: true,
                    is_suspended: true,
                    token_version: true,
                    tutor_profile: { select: { username: true } },
                    student_profile: { select: { username: true } },
                },
            });
            if (!user || user.is_suspended || user.token_version !== decoded.tv) return next(new Error('Unauthorized'));
            socket.userId = user.id;
            socket.role = user.role;
            socket.displayName = user.tutor_profile?.username || user.student_profile?.username || 'User';
            next();
        } catch {
            next(new Error('Unauthorized'));
        }
    });

    whiteboard.on('connection', (socket: AuthedSocket) => {
        socket.on('join', async (payload: unknown) => {
            const lessonId = (payload as { lessonId?: unknown } | null)?.lessonId;
            if (typeof lessonId !== 'string' || lessonId.length > 64 || !socket.userId) return;
            const ok = await userHasLessonAccess(socket.userId, lessonId).catch(() => false);
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
        let windowStart = Date.now();
        let snapshotsInWindow = 0;
        socket.on('scene:snapshot', (payload: unknown) => {
            const lessonId = socket.data.lessonId;
            const elements = (payload as { elements?: unknown } | null)?.elements;
            if (!lessonId || !Array.isArray(elements) || elements.length > MAX_SCENE_ELEMENTS) return;
            if (!elements.every((el) => el !== null && typeof el === 'object' && !Array.isArray(el))) return;
            const now = Date.now();
            if (now - windowStart > 10_000) {
                windowStart = now;
                snapshotsInWindow = 0;
            }
            if (++snapshotsInWindow > MAX_SNAPSHOTS_PER_10S) return;
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
