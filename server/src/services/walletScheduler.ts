import { WALLET_CONFIG, processCompletedLessons, settlePendingEarnings } from './walletService';

const INTERVAL_MS = Number(process.env.WALLET_SCHEDULER_INTERVAL_MS || 10 * 60 * 1000); // 10 minutes

let timer: NodeJS.Timeout | null = null;
let running = false;

export async function runWalletJobs() {
    if (running) return;
    running = true;
    try {
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
