/**
 * Backfill: recompute every tutor's denormalized rating + review_count from the
 * actual Review rows. Fixes drift where reviews exist but the profile still shows
 * 0 reviews / 0 rating (e.g. reviews inserted outside the createReview endpoint).
 *
 * Run: cd server && npx ts-node scripts/recalc-review-stats.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tutors = await prisma.tutorProfile.findMany({ select: { id: true, username: true } });
    console.log(`Recalculating review stats for ${tutors.length} tutors...`);

    let updated = 0;
    for (const tutor of tutors) {
        const agg = await prisma.review.aggregate({
            where: { tutor_id: tutor.id },
            _avg: { rating: true },
            _count: { rating: true },
        });

        const rating = agg._avg.rating || 0;
        const review_count = agg._count.rating || 0;

        const result = await prisma.tutorProfile.updateMany({
            where: {
                id: tutor.id,
                OR: [{ rating: { not: rating } }, { review_count: { not: review_count } }],
            },
            data: { rating, review_count },
        });

        if (result.count > 0) {
            updated++;
            console.log(`  ✓ ${tutor.username} (${tutor.id}): rating=${rating.toFixed(2)}, review_count=${review_count}`);
        }
    }

    console.log(`Done. Corrected ${updated} tutor(s).`);
}

main()
    .catch((e) => {
        console.error('recalc-review-stats failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
