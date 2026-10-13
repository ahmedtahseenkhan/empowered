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

export type MentorTier = 'STANDARD' | 'PRO' | 'PREMIUM';

/** Mentor subscription plans: annual billing. Price IDs from env or fallback for backward compatibility. */
export const MENTOR_PLANS = [
    {
        id: 'STANDARD' as const,
        name: 'Standard',
        priceMonthly: 25,
        annualAmount: 300,
        priceId: process.env.STRIPE_PRICE_STANDARD_ANNUAL || 'price_1StboAByCQ0ee0A8u7BMs9cl',
    },
    {
        id: 'PRO' as const,
        name: 'Pro',
        priceMonthly: 45,
        annualAmount: 540,
        priceId: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_1StboXByCQ0ee0A8GeuDW77K',
    },
    {
        id: 'PREMIUM' as const,
        name: 'Premium',
        priceMonthly: 85,
        annualAmount: 1020,
        priceId: process.env.STRIPE_PRICE_PREMIUM_ANNUAL || 'price_1StbozByCQ0ee0A8vJMmBvce',
    },
];

const TIER_BY_PRICE_ID = new Map<string, MentorTier>(MENTOR_PLANS.map((p) => [p.priceId, p.id]));

/** The tier a Stripe price grants — the only source of truth for a mentor's paid tier. Null for unknown prices. */
export const tierForPriceId = (priceId: string | null | undefined): MentorTier | null =>
    (priceId && TIER_BY_PRICE_ID.get(priceId)) || null;

/** Tier for a Stripe subscription, derived from the price it is actually billed on. */
export const tierForSubscription = (subscription: { items?: { data?: Array<{ price?: { id?: string } | null }> } } | null | undefined) =>
    tierForPriceId(subscription?.items?.data?.[0]?.price?.id);
