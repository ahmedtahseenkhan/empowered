/**
 * Wipe all profile photos: delete the referenced files from /uploads and set every
 * profile_photo column (tutor/student/admin) to NULL. Mentors can then re-upload
 * (uploads are now resized client-side to a few hundred KB).
 *
 * Only deletes files that are actually referenced as profile photos, so unrelated
 * attachments (homework, certifications) are left untouched.
 *
 * Usage:
 *   cd server && npx ts-node scripts/clear-photos.ts
 */
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const fileFromUrl = (value: string): string | null => {
    const marker = '/uploads/';
    const idx = value.indexOf(marker);
    if (idx < 0) return null;
    try {
        return decodeURIComponent(value.slice(idx + marker.length));
    } catch {
        return value.slice(idx + marker.length);
    }
};

async function clearModel(
    label: string,
    findMany: () => Promise<{ profile_photo: string | null }[]>,
    clearAll: () => Promise<{ count: number }>,
) {
    const rows = await findMany();
    let filesDeleted = 0;

    for (const row of rows) {
        if (!row.profile_photo || row.profile_photo.startsWith('data:')) continue;
        const file = fileFromUrl(row.profile_photo);
        if (!file) continue;
        const full = path.join(UPLOADS_DIR, file);
        try {
            if (fs.existsSync(full)) {
                fs.unlinkSync(full);
                filesDeleted++;
            }
        } catch (e) {
            console.warn(`  ! could not delete ${full}:`, e);
        }
    }

    const cleared = await clearAll();
    console.log(`${label}: deleted ${filesDeleted} file(s), cleared ${cleared.count} profile_photo value(s).`);
}

async function main() {
    console.log(`Clearing all profile photos. Uploads dir: ${UPLOADS_DIR}`);

    await clearModel(
        'Tutor',
        () => prisma.tutorProfile.findMany({ select: { profile_photo: true } }),
        () => prisma.tutorProfile.updateMany({ where: { NOT: { profile_photo: null } }, data: { profile_photo: null } }),
    );
    await clearModel(
        'Student',
        () => prisma.studentProfile.findMany({ select: { profile_photo: true } }),
        () => prisma.studentProfile.updateMany({ where: { NOT: { profile_photo: null } }, data: { profile_photo: null } }),
    );
    await clearModel(
        'Admin',
        () => prisma.adminProfile.findMany({ select: { profile_photo: true } }),
        () => prisma.adminProfile.updateMany({ where: { NOT: { profile_photo: null } }, data: { profile_photo: null } }),
    );

    console.log('Done.');
}

main()
    .catch((e) => {
        console.error('clear-photos failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
