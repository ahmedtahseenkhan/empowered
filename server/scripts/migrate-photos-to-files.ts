/**
 * One-off migration: convert legacy base64 `profile_photo` values (data: URLs)
 * into real files under /uploads and replace the DB column with a URL.
 *
 * Older profile photos were stored inline as multi-MB base64 strings, which
 * bloats API payloads (the mentor list could hit 10+ MB and time out).
 *
 * It also normalizes any existing ABSOLUTE upload URLs (e.g. http://host/uploads/x
 * or https://1.2.3.4/uploads/x) down to root-relative /uploads/x, which fixes
 * mixed-content and TLS cert-name errors when /uploads is served from the app origin.
 *
 * Usage:
 *   cd server
 *   npx ts-node scripts/migrate-photos-to-files.ts
 */
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

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
    return `/uploads/${encodeURIComponent(storedName)}`;
};

// Turn an absolute upload URL (any scheme/host) into a root-relative /uploads/... path.
const toRelativeUploadUrl = (value: string): string | null => {
    const idx = value.indexOf('/uploads/');
    if (idx <= 0) return null; // not absolute, or already relative (idx === 0)
    return value.slice(idx);
};

async function migrateModel(
    label: string,
    findMany: () => Promise<{ id: string; profile_photo: string | null }[]>,
    update: (id: string, url: string) => Promise<unknown>,
) {
    const rows = await findMany();
    let migrated = 0;

    for (const row of rows) {
        const photo = row.profile_photo;
        if (!photo) continue;

        let nextUrl: string | null = null;
        if (photo.startsWith('data:')) {
            nextUrl = writeDataUrlToFile(photo, label.toLowerCase());
            if (!nextUrl) {
                console.warn(`  ! ${label} ${row.id}: could not parse data URL, skipped.`);
                continue;
            }
        } else if (/^https?:\/\//i.test(photo)) {
            nextUrl = toRelativeUploadUrl(photo); // absolute upload URL -> relative
        }

        if (!nextUrl || nextUrl === photo) continue;

        await update(row.id, nextUrl);
        migrated++;
        console.log(`  ✓ ${label} ${row.id} -> ${nextUrl}`);
    }

    console.log(`${label}: fixed ${migrated} photo(s) (of ${rows.length} total).`);
    return migrated;
}

async function main() {
    console.log('Migrating base64 profile photos to files and normalizing absolute upload URLs to relative...');

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
