import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * One-off cleanup: clear `has_used_trial` for tutors who were wrongly flagged
 * by the old trial-activation gate, so approved beta mentors can claim their free month.
 *
 * Eligibility: APPROVED beta application matching the account email (case-insensitive),
 * `has_used_trial = true`, and NO real Stripe subscription (`stripe_subscription_id` null).
 *
 * Run with:  npx ts-node prisma/resetBetaTrialFlag.ts
 * Add --apply to actually write changes (defaults to a dry run).
 */
async function main() {
    const apply = process.argv.includes('--apply');

    const approvedEmails = (
        await prisma.betaApplication.findMany({
            where: { status: 'APPROVED' },
            select: { email: true },
        })
    )
        .map((a) => a.email.trim().toLowerCase())
        .filter(Boolean);

    const approvedSet = new Set(approvedEmails);

    // Candidates: flagged as having used trial but with no Stripe subscription attached.
    const candidates = await prisma.tutorProfile.findMany({
        where: {
            has_used_trial: true,
            stripe_subscription_id: null,
        },
        select: {
            id: true,
            subscription_status: true,
            user: { select: { email: true } },
        },
    });

    const toReset = candidates.filter((t) =>
        approvedSet.has(t.user.email.trim().toLowerCase())
    );

    console.log(`Approved beta emails: ${approvedSet.size}`);
    console.log(`Candidates (has_used_trial + no Stripe sub): ${candidates.length}`);
    console.log(`Matching approved beta mentors to reset: ${toReset.length}`);
    for (const t of toReset) {
        console.log(`  - ${t.user.email} (tutor ${t.id}, status=${t.subscription_status ?? 'null'})`);
    }

    if (!apply) {
        console.log('\nDry run. Re-run with --apply to write changes.');
        return;
    }

    if (toReset.length === 0) {
        console.log('\nNothing to update.');
        return;
    }

    const result = await prisma.tutorProfile.updateMany({
        where: { id: { in: toReset.map((t) => t.id) } },
        data: { has_used_trial: false },
    });
    console.log(`\nReset has_used_trial=false for ${result.count} tutor(s).`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
