/**
 * One-off migration: convert legacy base64 `profile_photo` values (data: URLs)
 * into real files under /uploads and replace the DB column with a URL.
 *
 * Older profile photos were stored inline as multi-MB base64 strings, which
 * bloats API payloads (the mentor list could hit 10+ MB and time out).
 *
 * Usage:
 *   cd server
 *   SERVER_PUBLIC_URL=https://api.emplearnings.com npx ts-node scripts/migrate-photos-to-files.ts
 *
 * SERVER_PUBLIC_URL must be the public origin that serves /uploads (the API host).
 * Defaults to http://localhost:3000 if not set.
 */
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const BASE_URL = (process.env.SERVER_PUBLIC_URL || 'http://localhost:3000').replace(/\/+$/, '');

const extForMime = (mime: string): string => {
    switch (mime) {
        case 'image/jpeg': return '.jpg';
        case 'image/png': return '.png';
        case 'image/webp': return '.webp';
        case 'image/gif': return '.gif';
        default: return '.jpg';
    }
};

const parseDataUrl = (dataUrl: string) => {
    const match = /^data:([^;,]*);base64,(.+)$/.exec(dataUrl);
    if (!match) return null;
    return { mimeType: match[1] || 'image/jpeg', base64: match[2] };
};

const writeDataUrlToFile = (dataUrl: string, prefix: string): string | null => {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return null;
    const buffer = Buffer.from(parsed.base64, 'base64');
    if (buffer.byteLength <= 0) return null;
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const ext = extForMime(parsed.mimeType);
    const storedName = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buffer);
    return `${BASE_URL}/uploads/${encodeURIComponent(storedName)}`;
};

async function migrateModel(
    label: string,
    findMany: () => Promise<{ id: string; profile_photo: string | null }[]>,
    update: (id: string, url: string) => Promise<unknown>,
) {
    const rows = await findMany();
    const targets = rows.filter((r) => r.profile_photo?.startsWith('data:'));
    console.log(`${label}: ${targets.length} base64 photo(s) to migrate (of ${rows.length} total).`);

    let migrated = 0;
    for (const row of targets) {
        const url = writeDataUrlToFile(row.profile_photo as string, label.toLowerCase());
        if (!url) {
            console.warn(`  ! ${label} ${row.id}: could not parse data URL, skipped.`);
            continue;
        }
        await update(row.id, url);
        migrated++;
        console.log(`  ✓ ${label} ${row.id} -> ${url}`);
    }
    return migrated;
}

async function main() {
    console.log(`Migrating base64 profile photos to files. Base URL: ${BASE_URL}`);

    let total = 0;
    total += await migrateModel(
        'Tutor',
        () => prisma.tutorProfile.findMany({ select: { id: true, profile_photo: true } }),
        (id, url) => prisma.tutorProfile.update({ where: { id }, data: { profile_photo: url } }),
    );
    total += await migrateModel(
        'Student',
        () => prisma.studentProfile.findMany({ select: { id: true, profile_photo: true } }),
        (id, url) => prisma.studentProfile.update({ where: { id }, data: { profile_photo: url } }),
    );
    total += await migrateModel(
        'Admin',
        () => prisma.adminProfile.findMany({ select: { id: true, profile_photo: true } }),
        (id, url) => prisma.adminProfile.update({ where: { id }, data: { profile_photo: url } }),
    );

    console.log(`Done. Migrated ${total} photo(s).`);
}

main()
    .catch((e) => {
        console.error('migrate-photos-to-files failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
