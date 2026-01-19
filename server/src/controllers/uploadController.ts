import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/authMiddleware';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const allowedMimeTypes = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const parseDataUrl = (dataUrl: string) => {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) return null;
    return { mimeType: match[1], base64: match[2] };
};

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

export const uploadBase64File = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const fileNameRaw = (req.body?.fileName as string | undefined)?.trim();
        const dataUrl = (req.body?.dataUrl as string | undefined) || '';

        if (!fileNameRaw) return res.status(400).json({ error: 'fileName is required' });
        if (!dataUrl) return res.status(400).json({ error: 'dataUrl is required' });

        const parsed = parseDataUrl(dataUrl);
        if (!parsed) return res.status(400).json({ error: 'dataUrl is invalid' });

        if (!allowedMimeTypes.has(parsed.mimeType)) {
            return res.status(400).json({ error: 'Unsupported file type' });
        }

        const buffer = Buffer.from(parsed.base64, 'base64');
        const size = buffer.byteLength;

        // keep within 15MB per file to avoid server abuse
        if (size <= 0) return res.status(400).json({ error: 'Empty file' });
        if (size > 15 * 1024 * 1024) return res.status(400).json({ error: 'File too large (max 15MB)' });

        fs.mkdirSync(UPLOADS_DIR, { recursive: true });

        const safeName = safeFileName(fileNameRaw);
        const ext = path.extname(safeName) || '';
        const base = path.basename(safeName, ext) || 'file';
        const storedName = `${base}-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
        const storedPath = path.join(UPLOADS_DIR, storedName);

        fs.writeFileSync(storedPath, buffer);

        const url = `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(storedName)}`;

        return res.status(201).json({
            attachment: {
                file_url: url,
                file_name: safeName,
                mime_type: parsed.mimeType,
                size,
            }
        });
    } catch (e) {
        console.error('uploadBase64File error:', e);
        return res.status(500).json({ error: 'Failed to upload file' });
    }
};
