/**
 * Creates Stripe Products and annual Prices for mentor subscription plans.
 * Run: npx ts-node scripts/create-annual-subscription-prices.ts
 *
 * Output: Price IDs to set in .env as STRIPE_PRICE_STANDARD_ANNUAL, etc.
 * Stripe Checkout will show: product name + "$300.00 / year" (monthly equivalent in product name).
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-12-18.acacia' as any,
});

const PLANS = [
    {
        id: 'STANDARD',
        productName: 'Standard Plan - $25/month (billed annually)',
        productDescription: '2 months free, then $300 per year. No charge today. Monthly equivalent $25.',
        annualAmountCents: 30000, // $300
    },
    {
        id: 'PRO',
        productName: 'Pro Plan - $45/month (billed annually)',
        productDescription: '2 months free, then $540 per year. No charge today. Monthly equivalent $45.',
        annualAmountCents: 54000, // $540
    },
    {
        id: 'PREMIUM',
        productName: 'Premium Plan - $85/month (billed annually)',
        productDescription: '2 months free, then $1,020 per year. No charge today. Monthly equivalent $85.',
        annualAmountCents: 102000, // $1020
    },
];

async function main() {
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('STRIPE_SECRET_KEY is required in .env');
        process.exit(1);
    }

    console.log('Creating Stripe Products and annual Prices...\n');

    for (const plan of PLANS) {
        try {
            const product = await stripe.products.create({
                name: plan.productName,
                description: plan.productDescription,
            });

            const price = await stripe.prices.create({
                product: product.id,
                unit_amount: plan.annualAmountCents,
                currency: 'usd',
                recurring: { interval: 'year' },
                nickname: `${plan.id} annual`,
            });

            console.log(`${plan.id}:`);
            console.log(`  Product ID: ${product.id}`);
            console.log(`  Price ID:  ${price.id}`);
            console.log(`  Add to .env: STRIPE_PRICE_${plan.id}_ANNUAL=${price.id}`);
            console.log('');
        } catch (e: any) {
            console.error(`Failed ${plan.id}:`, e.message);
        }
    }

    console.log('Done. Add the Price IDs above to your server .env and client plan config.');
}

main();
