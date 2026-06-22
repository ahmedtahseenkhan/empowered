/**
 * One-time grandfathering for the new "admin-approved mentors only" rule.
 *
 * The public mentor listing now requires TutorProfile.is_verified = true. To avoid
 * hiding mentors who were already live before this rule existed, this script approves
 * every mentor that has completed Stripe payout setup (stripe_account_id present) and
 * whose account is email-verified and not suspended — i.e. real, payment-ready mentors.
 *
 * Fake/bot, suspended, unverified-email, and not-yet-Stripe mentors are intentionally
 * left unapproved (hidden) and must be approved by an admin individually.
 *
 * Safe to re-run (idempotent).
 *
 * Usage:
 *   cd server && npx ts-node scripts/approve-existing-mentors.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const candidates = await prisma.tutorProfile.findMany({
        where: {
            is_verified: false,
            stripe_account_id: { not: null },
            user: { is_suspended: false, is_verified: true },
        },
        select: { id: true, username: true, user: { select: { email: true } } },
    });

    if (candidates.length === 0) {
        console.log('No mentors to grandfather (none are Stripe-ready + email-verified + unapproved).');
        return;
    }

    console.log(`Approving ${candidates.length} existing mentor(s):`);
    for (const m of candidates) {
        console.log(`  - ${m.username} <${m.user?.email}>`);
    }

    const result = await prisma.tutorProfile.updateMany({
        where: {
            is_verified: false,
            stripe_account_id: { not: null },
            user: { is_suspended: false, is_verified: true },
        },
        data: { is_verified: true },
    });

    console.log(`Done. Approved ${result.count} mentor(s).`);
}

main()
    .catch((e) => {
        console.error('approve-existing-mentors failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
