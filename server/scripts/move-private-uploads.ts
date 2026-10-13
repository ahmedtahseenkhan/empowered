/**
 * One-time migration: move files that should be private (session-note attachments and payout
 * proofs) out of the public uploads/ folder into uploads_private/, and point their database
 * rows at the authenticated /api/files route. New uploads are stored this way already.
 *
 * Run from the server directory on the machine that holds the uploads folder. Safe to re-run:
 * rows that already use /api/files/ are skipped, and missing files are reported, not changed.
 *
 * Usage:
 *   cd server && npx ts-node scripts/move-private-uploads.ts
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const PRIVATE_DIR = path.join(process.cwd(), 'uploads_private');
const PUBLIC_URL = /^(?:https?:\/\/[^/]+)?\/(?:api\/)?uploads\/([A-Za-z0-9._-]+)$/;

/** Move one public upload into the private folder; returns the new URL, or null if not movable. */
function movePublicFile(url: string): string | null {
    const match = PUBLIC_URL.exec(url);
    if (!match) return null;
    const source = path.join(UPLOADS_DIR, match[1]);
    if (!fs.existsSync(source)) {
        console.warn(`  missing on disk, left unchanged: ${url}`);
        return null;
    }
    const rawExt = path.extname(match[1]).toLowerCase();
    const ext = rawExt === '.jpeg' ? '.jpg' : rawExt;
    // Must match the names the /api/files route serves (see uploadController PRIVATE_NAME_RE)
    if (!['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png', '.webp', '.gif'].includes(ext)) {
        console.warn(`  unsupported type, left unchanged: ${url}`);
        return null;
    }
    const storedName = `${randomUUID()}${ext}`;
    fs.renameSync(source, path.join(PRIVATE_DIR, storedName));
    return `/api/files/${storedName}`;
}

async function main() {
    fs.mkdirSync(PRIVATE_DIR, { recursive: true });
    let moved = 0;

    const attachments = await prisma.attachment.findMany({ select: { id: true, file_url: true } });
    for (const a of attachments) {
        const next = movePublicFile(a.file_url);
        if (!next) continue;
        await prisma.attachment.update({ where: { id: a.id }, data: { file_url: next } });
        moved++;
    }

    const payouts = await prisma.mentorPayout.findMany({ where: { proof_url: { not: null } }, select: { id: true, proof_url: true } });
    for (const p of payouts) {
        const next = movePublicFile(p.proof_url!);
        if (!next) continue;
        await prisma.mentorPayout.update({ where: { id: p.id }, data: { proof_url: next } });
        moved++;
    }

    console.log(`Moved ${moved} files to uploads_private (${attachments.length} attachments, ${payouts.length} payout proofs checked).`);
}

main()
    .catch((e) => {
        console.error('Migration failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
