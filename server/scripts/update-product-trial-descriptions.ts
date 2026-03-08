/**
 * Updates existing Stripe Products (for mentor plans) to trial-friendly copy.
 * Run once after enabling 2-month free trial so Checkout no longer shows "You will be charged $X today."
 *
 * Run from server/: npx ts-node scripts/update-product-trial-descriptions.ts
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-12-18.acacia' as any,
});

const TRIAL_COPY: Record<string, { name: string; description: string }> = {
    STANDARD: {
        name: 'Standard Plan - $25/month (billed annually)',
        description: '2 months free, then $300 per year. No charge today. Monthly equivalent $25.',
    },
    PRO: {
        name: 'Pro Plan - $45/month (billed annually)',
        description: '2 months free, then $540 per year. No charge today. Monthly equivalent $45.',
    },
    PREMIUM: {
        name: 'Premium Plan - $85/month (billed annually)',
        description: '2 months free, then $1,020 per year. No charge today. Monthly equivalent $85.',
    },
};

const PRICE_ENV_KEYS = [
    { key: 'STRIPE_PRICE_STANDARD_ANNUAL', planId: 'STANDARD' },
    { key: 'STRIPE_PRICE_PRO_ANNUAL', planId: 'PRO' },
    { key: 'STRIPE_PRICE_PREMIUM_ANNUAL', planId: 'PREMIUM' },
] as const;

async function main() {
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('STRIPE_SECRET_KEY is required in .env');
        process.exit(1);
    }

    console.log('Updating Stripe product descriptions for 2-month free trial...\n');

    for (const { key, planId } of PRICE_ENV_KEYS) {
        const priceId = process.env[key];
        if (!priceId) {
            console.warn(`Skip ${planId}: ${key} not set in .env`);
            continue;
        }

        try {
            const price = await stripe.prices.retrieve(priceId);
            const productId = typeof price.product === 'string' ? price.product : price.product?.id;
            if (!productId) {
                console.warn(`Skip ${planId}: price has no product`);
                continue;
            }

            const copy = TRIAL_COPY[planId];
            if (!copy) continue;

            await stripe.products.update(productId, {
                name: copy.name,
                description: copy.description,
            });

            console.log(`Updated product for ${planId} (price ${priceId})`);
        } catch (e: any) {
            console.error(`Failed ${planId}:`, e.message);
        }
    }

    console.log('\nDone. Checkout will now show "No charge today" and "2 months free".');
}

main();
