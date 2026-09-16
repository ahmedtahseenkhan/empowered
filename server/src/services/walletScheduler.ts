import prisma from '../config/db';
import { WALLET_CONFIG, processCompletedLessons, settlePendingEarnings, runMonthlySettlement } from './walletService';
import { ensureMeetLinkForLesson } from './googleCalendar';

/** Ask the student to confirm a just-ended credit-funded session (their confirmation
 *  releases the mentor's payment; the grace-window backstop covers non-responders). */
async function requestCompletionConfirmations() {
    const lessons = await prisma.lesson.findMany({
        where: {
            status: 'BOOKED',
            student_confirmed_at: null,
            end_time: { lte: new Date(), gte: new Date(Date.now() - 6 * 3600 * 1000) },
            booking: { funding: 'CREDITS' },
        },
        select: { id: true, student: { select: { user: { select: { email: true } } } } },
        take: 100,
    });
    for (const l of lessons) {
        const email = l.student?.user?.email;
        if (!email) continue;
        try {
            await prisma.emailOutbox.create({
                data: {
                    type: 'SESSION_CONFIRM_REQUEST_STUDENT',
                    to_email: email,
                    payload: {
                        lessonId: l.id,
                        graceHours: Math.round(WALLET_CONFIG.completionGraceMinutes / 60),
                        reviewDays: WALLET_CONFIG.settlementDays,
                    },
                    idempotency_key: `session-confirm-request:${l.id}`,
                },
            });
        } catch (e: any) {
            if (e.code !== 'P2002') console.error(`[Wallet] Failed to queue confirm request for ${l.id}:`, e);
        }
    }
}

/** BOOKED lessons that never got a Meet link (calendar failure at booking time) get one retried here. */
async function backfillMissingMeetingLinks() {
    const lessons = await prisma.lesson.findMany({
        where: {
            status: 'BOOKED',
            meeting_link: null,
            start_time: { lte: new Date(Date.now() + 48 * 3600 * 1000) },
            end_time: { gte: new Date(Date.now() - 2 * 3600 * 1000) },
        },
        select: { id: true },
        take: 20,
    });
    let fixed = 0;
    for (const l of lessons) {
        try {
            if (await ensureMeetLinkForLesson(l.id)) fixed += 1;
        } catch (e) {
            console.error(`[Scheduler] Meet-link backfill failed for lesson ${l.id}:`, e);
        }
    }
    if (fixed) console.log(`[Scheduler] Backfilled meeting links for ${fixed} lesson(s)`);
    return { fixed };
}

const INTERVAL_MS = Number(process.env.WALLET_SCHEDULER_INTERVAL_MS || 10 * 60 * 1000); // 10 minutes

let timer: NodeJS.Timeout | null = null;
let running = false;

export async function runWalletJobs() {
    if (running) return;
    running = true;
    try {
        await backfillMissingMeetingLinks();
        await requestCompletionConfirmations();
        const c = await processCompletedLessons();
        const s = await settlePendingEarnings();
        if (c.completed || c.returned || s.settled) {
            console.log(`[Wallet] completed=${c.completed} returned=${c.returned} settled=${s.settled}`);
        }
        // Monthly mentor settlement — the unique per-period run row makes this idempotent,
        // so checking on every tick is safe.
        if (new Date().getDate() === WALLET_CONFIG.settlementDayOfMonth) {
            const r = await runMonthlySettlement({ triggeredBy: 'scheduler' });
            if (!r.already_ran) console.log(`[Wallet] Monthly settlement ${r.period}: ${r.created} payout(s)`);
        }
    } catch (e) {
        console.error('[Wallet] Scheduler error:', e);
    } finally {
        running = false;
    }
}

export function startWalletScheduler() {
    if (!WALLET_CONFIG.enabled) {
        console.log('[Wallet] Disabled by WALLET_ENABLED=false');
        return;
    }
    if (timer) return;
    console.log(`[Wallet] Starting scheduler (interval=${INTERVAL_MS}ms, fee=${WALLET_CONFIG.feePercent}%, settlement=${WALLET_CONFIG.settlementDays}d)`);
    runWalletJobs();
    timer = setInterval(runWalletJobs, INTERVAL_MS);
}

export function stopWalletScheduler() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}
