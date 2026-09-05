import prisma from '../config/db';
import { WALLET_CONFIG, processCompletedLessons, settlePendingEarnings } from './walletService';
import { ensureMeetLinkForLesson } from './googleCalendar';

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
        const c = await processCompletedLessons();
        const s = await settlePendingEarnings();
        if (c.completed || c.returned || s.settled) {
            console.log(`[Wallet] completed=${c.completed} returned=${c.returned} settled=${s.settled}`);
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
