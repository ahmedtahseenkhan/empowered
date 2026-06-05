import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/authMiddleware';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

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

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

export const uploadBase64File = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const fileNameRaw = (req.body?.fileName as string | undefined)?.trim();
        const dataUrl = (req.body?.dataUrl as string | undefined) || '';

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

        fs.mkdirSync(UPLOADS_DIR, { recursive: true });

        const safeName = safeFileName(fileNameRaw);
        const base = path.basename(safeName, ext) || 'file';
        const storedName = `${base}-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
        const storedPath = path.join(UPLOADS_DIR, storedName);

        fs.writeFileSync(storedPath, buffer);

        const url = `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(storedName)}`;

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
