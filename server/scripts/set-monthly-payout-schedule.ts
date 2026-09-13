/**
 * One-off backfill: switch every connected mentor account to the monthly payout
 * schedule (anchor: 1st). New accounts get this automatically at creation.
 * Run: npm run payouts:monthly-schedule
 */
import prisma from '../src/config/db';
import { StripeService } from '../src/services/stripeService';

async function main() {
    const tutors = await prisma.tutorProfile.findMany({
        where: { stripe_account_id: { not: null } },
        select: { id: true, username: true, stripe_account_id: true },
    });
    console.log(`Updating payout schedule for ${tutors.length} connected account(s)…`);
    for (const t of tutors) {
        try {
            await StripeService.setMonthlyPayoutSchedule(t.stripe_account_id!);
            console.log(`OK    ${t.username} (${t.stripe_account_id})`);
        } catch (e) {
            console.error(`FAIL  ${t.username} (${t.stripe_account_id}):`, (e as Error).message);
        }
    }
    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
