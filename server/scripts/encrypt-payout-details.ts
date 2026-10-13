/**
 * One-time backfill: encrypt mentor payout details (Zelle contact, bank account number,
 * routing) that were saved before field-level encryption existed. New saves are encrypted
 * by walletService.updateMentorPayoutSettings.
 *
 * Requires TOKEN_ENCRYPTION_KEY (the same value the server uses). Safe to re-run: values
 * that are already encrypted are skipped.
 *
 * Usage:
 *   cd server && npx ts-node scripts/encrypt-payout-details.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { encryptField } from '../src/utils/crypto';

const prisma = new PrismaClient();
const isEncrypted = (v: string | null) => v === null || v.startsWith('enc:v1:');

async function main() {
    const tutors = await prisma.tutorProfile.findMany({
        where: {
            OR: [
                { payout_zelle_contact: { not: null } },
                { payout_bank_account_number: { not: null } },
                { payout_bank_routing: { not: null } },
            ],
        },
        select: { id: true, payout_zelle_contact: true, payout_bank_account_number: true, payout_bank_routing: true },
    });

    let updated = 0;
    for (const t of tutors) {
        if (isEncrypted(t.payout_zelle_contact) && isEncrypted(t.payout_bank_account_number) && isEncrypted(t.payout_bank_routing)) continue;
        await prisma.tutorProfile.update({
            where: { id: t.id },
            data: {
                payout_zelle_contact: isEncrypted(t.payout_zelle_contact) ? t.payout_zelle_contact : encryptField(t.payout_zelle_contact),
                payout_bank_account_number: isEncrypted(t.payout_bank_account_number) ? t.payout_bank_account_number : encryptField(t.payout_bank_account_number),
                payout_bank_routing: isEncrypted(t.payout_bank_routing) ? t.payout_bank_routing : encryptField(t.payout_bank_routing),
            },
        });
        updated++;
    }
    console.log(`Encrypted payout details for ${updated} of ${tutors.length} mentors.`);
}

main()
    .catch((e) => {
        console.error('Backfill failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
