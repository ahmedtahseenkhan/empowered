/**
 * Temporary end-to-end check of the Learning Credits ledger against the local DB.
 * Creates a throwaway student + mentor, runs the full lifecycle, asserts balances, then deletes everything it created.
 */
import prisma from '../src/config/db';
import * as w from '../src/services/walletService';

let failures = 0;
const check = (label: string, cond: boolean, extra?: unknown) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : `  -> ${JSON.stringify(extra)}`}`);
    if (!cond) failures += 1;
};

async function main() {
    const stamp = Date.now();
    const H = 3600 * 1000;
    const studentUser = await prisma.user.create({
        data: { email: `wallet-smoke-student-${stamp}@example.com`, password_hash: 'x', role: 'STUDENT', is_verified: true, student_profile: { create: { username: 'Smoke Student' } } },
        include: { student_profile: true },
    });
    const tutorUser = await prisma.user.create({
        data: { email: `wallet-smoke-tutor-${stamp}@example.com`, password_hash: 'x', role: 'TUTOR', is_verified: true, tutor_profile: { create: { username: 'Smoke Mentor', hourly_rate: 25 } } },
        include: { tutor_profile: true },
    });
    const student = studentUser.student_profile!;
    const tutor = tutorUser.tutor_profile!;
    const admin = studentUser.id;
    let bookingId = '';

    try {
        // 1. Grant promo credits
        await w.adminAdjustCredits({ studentId: student.id, amount: 100, type: 'PROMO_GRANT', reason: 'smoke grant', adminUserId: admin });
        let ws = await w.getStudentWallet(student.id);
        check('grant 100 promo credits', ws.available === 100 && ws.promotional === 100 && ws.reserved === 0, ws);

        // 2. Reserve 4 sessions (2 already in the past so they can be auto-completed)
        const starts = [Date.now() - 50 * H, Date.now() - 26 * H, Date.now() + 48 * H, Date.now() + 7 * 24 * H];
        const res = await prisma.$transaction(async (tx) => {
            const booking = await tx.booking.create({
                data: { student_id: student.id, tutor_id: tutor.id, start_date: new Date(starts[0]), end_date: new Date(starts[3] + H), frequency: 'WEEKLY', funding: 'CREDITS', status: 'active' },
            });
            const lessons = [];
            for (const t of starts) {
                lessons.push(await tx.lesson.create({
                    data: { tutor_id: tutor.id, student_id: student.id, booking_id: booking.id, start_time: new Date(t), end_time: new Date(t + H), duration: 60, status: 'BOOKED', billing_type: 'PAID' },
                }));
            }
            const r = await w.reserveCreditsForLessons(tx, { studentId: student.id, bookingId: booking.id, lessons, creditsPerSession: 25, description: 'smoke reserve' });
            return { booking, lessons, r };
        });
        bookingId = res.booking.id;
        ws = await w.getStudentWallet(student.id);
        check('reserve 100 (promo spent first)', ws.available === 0 && ws.promotional === 0 && ws.reserved === 100 && res.r.promoUsed === 100, ws);

        // 3. Over-reserve is rejected
        let threw: unknown = null;
        try {
            await prisma.$transaction((tx) => w.reserveCreditsForLessons(tx, { studentId: student.id, bookingId, lessons: [{ id: res.lessons[2].id, start_time: res.lessons[2].start_time }], creditsPerSession: 25, description: 'x' }));
        } catch (e) { threw = e; }
        check('insufficient credits rejected with 402', threw instanceof w.WalletError && threw.status === 402, String(threw));

        // 4. Auto-complete past sessions -> mentor PENDING earnings
        const c = await w.processCompletedLessons();
        const earnings = await prisma.mentorEarning.findMany({ where: { tutor_id: tutor.id }, orderBy: { created_at: 'asc' } });
        ws = await w.getStudentWallet(student.id);
        check('2 past sessions completed', c.completed >= 2 && earnings.length === 2, { c, n: earnings.length });
        check('earning math: gross 2500, fee 125 (5%), net 2375, promo 2500, PENDING',
            earnings.every((e) => e.gross_cents === 2500 && e.fee_cents === 125 && e.net_cents === 2375 && e.promo_cents === 2500 && e.status === 'PENDING'), earnings);
        check('reserved drops to 50 after release', ws.reserved === 50 && ws.available === 0, ws);
        const completedLessons = await prisma.lesson.findMany({ where: { booking_id: bookingId, status: 'COMPLETED' } });
        check('lessons marked COMPLETED with completed_at', completedLessons.length === 2 && completedLessons.every((l) => !!l.completed_at));

        // 5. Settlement window -> AVAILABLE
        await prisma.mentorEarning.update({ where: { id: earnings[0].id }, data: { available_at: new Date(Date.now() - 1000) } });
        const s = await w.settlePendingEarnings();
        const e0 = await prisma.mentorEarning.findUnique({ where: { id: earnings[0].id } });
        check('earning past window becomes AVAILABLE', s.settled >= 1 && e0?.status === 'AVAILABLE' && !!e0?.settled_at, e0);

        // 6. Dispute after window closed is rejected
        threw = null;
        try { await w.openDispute({ studentId: student.id, lessonId: earnings[0].lesson_id, reason: 'Late report on a settled session' }); } catch (e) { threw = e; }
        check('report rejected once earning is AVAILABLE', threw instanceof w.WalletError, String(threw));

        // 7. Dispute inside window -> ON_HOLD -> REFUND
        const d = await w.openDispute({ studentId: student.id, lessonId: earnings[1].lesson_id, reason: 'Mentor did not show up at all' });
        let e1 = await prisma.mentorEarning.findUnique({ where: { id: earnings[1].id } });
        check('open dispute puts earning ON_HOLD', d.status === 'OPEN' && e1?.status === 'ON_HOLD', e1);
        const settleAgain = await w.settlePendingEarnings();
        e1 = await prisma.mentorEarning.findUnique({ where: { id: earnings[1].id } });
        check('ON_HOLD earning is not settled by the scheduler', e1?.status === 'ON_HOLD', settleAgain);
        await w.resolveDispute({ disputeId: d.id, adminUserId: admin, action: 'REFUND', note: 'smoke refund' });
        e1 = await prisma.mentorEarning.findUnique({ where: { id: earnings[1].id } });
        ws = await w.getStudentWallet(student.id);
        check('REFUND: earning REVERSED, 25 promo credits back to student', e1?.status === 'REVERSED' && ws.available === 25 && ws.promotional === 25, { e1, ws });

        // 8. Cancel a future session (7 days out) -> credits returned
        const cancelled = await w.cancelReservedLesson({ studentId: student.id, lessonId: res.lessons[3].id });
        ws = await w.getStudentWallet(student.id);
        check('cancel 7-days-out session returns 25 credits', cancelled.reservation.status === 'RETURNED' && ws.available === 50 && ws.reserved === 25, ws);

        // 9. Cancel inside the 24h cutoff is rejected
        await prisma.lesson.update({ where: { id: res.lessons[2].id }, data: { start_time: new Date(Date.now() + 2 * H), end_time: new Date(Date.now() + 3 * H) } });
        threw = null;
        try { await w.cancelReservedLesson({ studentId: student.id, lessonId: res.lessons[2].id }); } catch (e) { threw = e; }
        check('cancel within 24h rejected', threw instanceof w.WalletError, String(threw));

        // 10. Manual payout of AVAILABLE earnings
        const mp = await w.markEarningsPaid({ tutorId: tutor.id, note: 'smoke payout ref', adminUserId: admin });
        const me = await w.getMentorEarnings(tutor.id);
        check('mark paid: 1 earning PAID, totals correct', mp.count === 1 && me.totals.paid_cents === 2375 && me.totals.reversed_cents === 2375 && me.totals.available_cents === 0, me.totals);

        // 11. Ledger integrity: sum of ledger amounts == available balance
        const ledger = await prisma.creditLedger.findMany({ where: { student_id: student.id }, orderBy: { created_at: 'asc' } });
        const sum = ledger.reduce((a, e) => a + e.amount, 0);
        const last = ledger[ledger.length - 1];
        check('ledger sums to available balance', sum === ws.available && last.balance_after === ws.available, { sum, available: ws.available, rows: ledger.length });

        // 12. Negative adjustment cannot overdraw
        threw = null;
        try { await w.adminAdjustCredits({ studentId: student.id, amount: -999, type: 'MANUAL_ADJUSTMENT', reason: 'x', adminUserId: admin }); } catch (e) { threw = e; }
        check('negative adjustment beyond balance rejected', threw instanceof w.WalletError, String(threw));
    } finally {
        // Cleanup everything this script created
        await prisma.sessionDispute.deleteMany({ where: { student_id: student.id } });
        await prisma.mentorEarning.deleteMany({ where: { student_id: student.id } });
        await prisma.sessionReservation.deleteMany({ where: { student_id: student.id } });
        await prisma.creditLedger.deleteMany({ where: { student_id: student.id } });
        await prisma.lesson.deleteMany({ where: { student_id: student.id } });
        await prisma.booking.deleteMany({ where: { student_id: student.id } });
        await prisma.studentProfile.delete({ where: { id: student.id } });
        await prisma.tutorProfile.delete({ where: { id: tutor.id } });
        await prisma.user.deleteMany({ where: { id: { in: [studentUser.id, tutorUser.id] } } });
        await prisma.$disconnect();
    }

    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
