/**
 * Card-paid bookings: the platform fee is ADDED on top of the mentor's rate
 * (student pays rate × 1.10; mentor receives the full rate).
 * Credit-funded bookings use WALLET_CONFIG.feePercent instead, which is
 * DEDUCTED from the mentor's earning.
 */
export const CARD_PLATFORM_FEE_RATE = 0.10;

/** Split a card charge (which already includes the fee) back into mentor + platform parts. */
export function splitCardCharge(amountCharged: number) {
    const tutorEarnings = Math.round((amountCharged / (1 + CARD_PLATFORM_FEE_RATE)) * 100) / 100;
    const platformFee = Math.round((amountCharged - tutorEarnings) * 100) / 100;
    return { tutorEarnings, platformFee };
}
