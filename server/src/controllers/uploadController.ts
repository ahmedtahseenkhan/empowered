import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { stripImageMetadata } from '../utils/stripImageMetadata';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
// Documents and private images (payout proofs, session-note files) are never served statically;
// only the authenticated GET /api/files/:name route reads them.
// Outside the statically served uploads/ folder, so no URL trick can reach it without the /api/files checks
const PRIVATE_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads_private');

// Hard limit per file. Note: base64 inflates size ~33%, but we validate the
// DECODED buffer size, so this is the true on-disk limit.
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

type Signature = 'pdf' | 'ole' | 'zip';

// We key off the file EXTENSION (not the client-supplied data URL MIME, which is
// unreliable across browsers and trivially spoofed) and then verify the actual
// file CONTENT via magic bytes. Both must agree for the upload to be accepted.
const ALLOWED_TYPES: Record<string, { mime: string; sigs: Signature[] }> = {
    '.pdf': { mime: 'application/pdf', sigs: ['pdf'] },
    '.doc': { mime: 'application/msword', sigs: ['ole'] },
    '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sigs: ['zip'] },
    '.xls': { mime: 'application/vnd.ms-excel', sigs: ['ole'] },
    '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sigs: ['zip'] },
};

// OLE2 / Compound File Binary header (legacy .doc and .xls)
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const matchesSignature = (buf: Buffer, sig: Signature): boolean => {
    if (sig === 'pdf') {
        return buf.length >= 5 && buf.toString('latin1', 0, 5) === '%PDF-';
    }
    if (sig === 'ole') {
        return buf.length >= 8 && buf.subarray(0, 8).equals(OLE_MAGIC);
    }
    if (sig === 'zip') {
        // OOXML (.docx/.xlsx) are ZIP archives: PK\x03\x04 (also \x05\x06 / \x07\x08)
        return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b &&
            (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07);
    }
    return false;
};

// Accepts `data:<mime>;base64,...` and tolerates an empty/omitted mime
// (`data:;base64,...`) which some browsers emit for Office files.
const parseDataUrl = (dataUrl: string) => {
    const match = /^data:([^;,]*);base64,(.+)$/.exec(dataUrl);
    if (!match) return null;
    return { mimeType: match[1], base64: match[2] };
};

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-200);

/** Write a buffer under a random name and return the stored file name. Private files record their uploader. */
const storeFile = (buffer: Buffer, ext: string, isPrivate: boolean, ownerUserId?: string): string => {
    const dir = isPrivate ? PRIVATE_UPLOADS_DIR : UPLOADS_DIR;
    fs.mkdirSync(dir, { recursive: true });
    const storedName = `${crypto.randomUUID()}${ext}`;
    fs.writeFileSync(path.join(dir, storedName), buffer, { flag: 'wx' });
    if (isPrivate && ownerUserId) fs.writeFileSync(path.join(dir, `${storedName}.owner`), ownerUserId, { flag: 'wx' });
    return storedName;
};

/**
 * Who may download a private file: admins, the uploader, the tutor/student on the note, task or
 * submission it is attached to, and the mentor a payout proof belongs to.
 */
const canAccessPrivateFile = async (name: string, user: { id: string; role: string }): Promise<boolean> => {
    if (user.role === 'ADMIN') return true;

    const owner = await fs.promises.readFile(path.join(PRIVATE_UPLOADS_DIR, `${name}.owner`), 'utf8').catch(() => null);
    if (owner && owner.trim() === user.id) return true;

    const url = `/api/files/${name}`;
    const attachments = await prisma.attachment.findMany({
        where: { file_url: url },
        select: {
            note: { select: { visibility: true, tutor: { select: { user_id: true } }, student: { select: { user_id: true } } } },
            task: { select: { tutor: { select: { user_id: true } }, student: { select: { user_id: true } } } },
            submission: {
                select: {
                    student: { select: { user_id: true } },
                    task: { select: { tutor: { select: { user_id: true } } } },
                },
            },
        },
    });
    for (const a of attachments) {
        if (a.note) {
            if (a.note.tutor.user_id === user.id) return true;
            if (a.note.student.user_id === user.id && a.note.visibility === 'SHARED_WITH_STUDENT') return true;
        }
        if (a.task && (a.task.tutor.user_id === user.id || a.task.student.user_id === user.id)) return true;
        if (a.submission && (a.submission.student.user_id === user.id || a.submission.task.tutor.user_id === user.id)) return true;
    }

    const payout = await prisma.mentorPayout.findFirst({
        where: { proof_url: url, tutor: { user_id: user.id } },
        select: { id: true },
    });
    return !!payout;
};

// Root-relative under /api so it goes through the same proxy as the API and
// inherits the page's scheme/host (avoids mixed-content and cert issues).
const urlFor = (storedName: string, isPrivate: boolean) =>
    isPrivate ? `/api/files/${storedName}` : `/api/uploads/${storedName}`;

// ─── Image upload (profile photos, etc.) ───────────────────────────────────
// Stored as real files on disk and referenced by URL, so we never persist huge
// base64 blobs in the DB (which bloats rows and can blow past the request body
// limit on subsequent saves).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const IMAGE_TYPES: Record<string, { mime: string; check: (b: Buffer) => boolean }> = {
    '.jpg': { mime: 'image/jpeg', check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    '.jpeg': { mime: 'image/jpeg', check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    '.png': { mime: 'image/png', check: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    '.webp': { mime: 'image/webp', check: (b) => b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' },
    '.gif': { mime: 'image/gif', check: (b) => b.length >= 6 && (b.toString('latin1', 0, 6) === 'GIF87a' || b.toString('latin1', 0, 6) === 'GIF89a') },
};

const extForImageMime = (mime: string): string | null => {
    switch (mime) {
        case 'image/jpeg': return '.jpg';
        case 'image/png': return '.png';
        case 'image/webp': return '.webp';
        case 'image/gif': return '.gif';
        default: return null;
    }
};

export const uploadBase64Image = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
        if (!dataUrl) return res.status(400).json({ error: 'dataUrl is required' });

        const parsed = parseDataUrl(dataUrl);
        if (!parsed) return res.status(400).json({ error: 'dataUrl is invalid' });

        // Derive extension from an explicit fileName if provided, otherwise from the
        // data URL MIME. The actual bytes are still verified against the type below.
        const fileNameRaw = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : undefined;
        const ext = (fileNameRaw ? path.extname(fileNameRaw).toLowerCase() : '') || extForImageMime(parsed.mimeType) || '';
        const rule = IMAGE_TYPES[ext];
        if (!rule) {
            return res.status(400).json({ error: 'Unsupported image type. Only JPG, PNG, WEBP and GIF are allowed.' });
        }

        const raw = Buffer.from(parsed.base64, 'base64');
        if (raw.byteLength <= 0) return res.status(400).json({ error: 'Empty file' });
        if (raw.byteLength > MAX_IMAGE_BYTES) {
            return res.status(400).json({ error: 'Image too large (max 5MB)' });
        }
        if (!rule.check(raw)) {
            return res.status(400).json({ error: 'File content does not match its image type.' });
        }

        // Drop EXIF/XMP (GPS location, camera serials) before the file is stored.
        const buffer = stripImageMetadata(raw, rule.mime);
        const size = buffer.byteLength;

        // Admin uploads are payout proofs; other callers opt in with `private: true`.
        const isPrivate = req.body?.private === true || req.user?.role === 'ADMIN';
        const storedName = storeFile(buffer, extForImageMime(rule.mime) || ext, isPrivate, req.user?.id);

        return res.status(201).json({ url: urlFor(storedName, isPrivate), mime_type: rule.mime, size });
    } catch (e) {
        console.error('uploadBase64Image error:', e);
        return res.status(500).json({ error: 'Failed to upload image' });
    }
};

export const uploadBase64File = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const fileNameRaw = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
        const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';

        if (!fileNameRaw) return res.status(400).json({ error: 'fileName is required' });
        if (!dataUrl) return res.status(400).json({ error: 'dataUrl is required' });

        const ext = path.extname(fileNameRaw).toLowerCase();
        const rule = ALLOWED_TYPES[ext];
        if (!rule) {
            return res.status(400).json({ error: 'Unsupported file type. Only PDF, Word (.doc/.docx) and Excel (.xls/.xlsx) files are allowed.' });
        }

        const parsed = parseDataUrl(dataUrl);
        if (!parsed) return res.status(400).json({ error: 'dataUrl is invalid' });

        const buffer = Buffer.from(parsed.base64, 'base64');
        const size = buffer.byteLength;

        if (size <= 0) return res.status(400).json({ error: 'Empty file' });
        if (size > MAX_FILE_BYTES) {
            return res.status(400).json({ error: 'File too large (max 2MB)' });
        }

        // The decoded bytes must actually be the file type the extension claims.
        // This blocks renamed scripts/HTML/SVG/executables disguised as documents.
        if (!rule.sigs.some((s) => matchesSignature(buffer, s))) {
            return res.status(400).json({ error: 'File content does not match its extension.' });
        }

        const safeName = safeFileName(fileNameRaw);
        const storedName = storeFile(buffer, ext, true, req.user?.id);
        const url = urlFor(storedName, true);

        return res.status(201).json({
            attachment: {
                file_url: url,
                file_name: safeName,
                // Store the canonical MIME derived from the validated extension,
                // never the client-supplied one.
                mime_type: rule.mime,
                size,
            },
        });
    } catch (e) {
        console.error('uploadBase64File error:', e);
        return res.status(500).json({ error: 'Failed to upload file' });
    }
};

// ─── Private file download (GET /api/files/:name) ──────────────────────────
const PRIVATE_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.(?:pdf|docx?|xlsx?|jpg|png|webp|gif))$/;

const PRIVATE_FILE_TYPES: Record<string, { mime: string; inline: boolean }> = {
    '.pdf': { mime: 'application/pdf', inline: true },
    '.doc': { mime: ALLOWED_TYPES['.doc'].mime, inline: false },
    '.docx': { mime: ALLOWED_TYPES['.docx'].mime, inline: false },
    '.xls': { mime: ALLOWED_TYPES['.xls'].mime, inline: false },
    '.xlsx': { mime: ALLOWED_TYPES['.xlsx'].mime, inline: false },
    '.jpg': { mime: 'image/jpeg', inline: true },
    '.png': { mime: 'image/png', inline: true },
    '.webp': { mime: 'image/webp', inline: true },
    '.gif': { mime: 'image/gif', inline: true },
};

export const servePrivateFile = async (req: AuthRequest, res: Response) => {
    try {
        const name = String(req.params.name || '').toLowerCase();
        const match = PRIVATE_NAME_RE.exec(name);
        const type = match ? PRIVATE_FILE_TYPES[match[1]] : undefined;
        if (!match || !type) return res.status(404).json({ error: 'Not found' });

        const filePath = path.resolve(PRIVATE_UPLOADS_DIR, name);
        if (path.dirname(filePath) !== PRIVATE_UPLOADS_DIR) return res.status(404).json({ error: 'Not found' });

        const stat = await fs.promises.stat(filePath).catch(() => null);
        if (!stat || !stat.isFile()) return res.status(404).json({ error: 'Not found' });
        // 404 rather than 403 so the response doesn't confirm the file exists
        if (!req.user || !(await canAccessPrivateFile(name, req.user))) return res.status(404).json({ error: 'Not found' });

        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'");
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Type', type.mime);
        res.setHeader('Content-Length', String(stat.size));
        res.setHeader('Content-Disposition', type.inline ? 'inline' : `attachment; filename="${name}"`);

        const stream = fs.createReadStream(filePath);
        stream.on('error', (err) => {
            console.error('servePrivateFile stream error:', err);
            if (!res.headersSent) res.status(500).json({ error: 'Failed to read file' });
            else res.destroy();
        });
        stream.pipe(res);
    } catch (e) {
        console.error('servePrivateFile error:', e);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to read file' });
    }
};
