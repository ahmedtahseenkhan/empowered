import prisma from '../config/db';

/**
 * Recalculate a tutor's denormalized review stats (rating + review_count)
 * from the actual Review rows. Call this after any review create/update/delete
 * so the values shown on profiles/listings can never drift from reality.
 */
export async function recalculateTutorReviewStats(tutorId: string): Promise<{ rating: number; review_count: number }> {
    const aggregations = await prisma.review.aggregate({
        where: { tutor_id: tutorId },
        _avg: { rating: true },
        _count: { rating: true },
    });

    const rating = aggregations._avg.rating || 0;
    const review_count = aggregations._count.rating || 0;

    await prisma.tutorProfile.update({
        where: { id: tutorId },
        data: { rating, review_count },
    });

    return { rating, review_count };
}
