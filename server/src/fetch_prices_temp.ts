import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-12-18.acacia' as any,
});

const products = {
    STANDARD: 'prod_TrKTCqmEcnSmDh',
    PRO: 'prod_TrKTdoZNR1DuJH',
    PREMIUM: 'prod_TrKTjDkQndcCc9'
};

async function fetchPrices() {
    console.log('Fetching prices...');
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('STRIPE_SECRET_KEY not found in .env');
        process.exit(1);
    }

    for (const [plan, prodId] of Object.entries(products)) {
        try {
            const prices = await stripe.prices.list({ product: prodId, active: true, limit: 1 });
            if (prices.data.length > 0) {
                console.log(`${plan}: ${prices.data[0].id}`);
            } else {
                console.log(`${plan}: No price found for product ${prodId}`);
            }
        } catch (error: any) {
            console.error(`Error fetching ${plan}:`, error.message);
        }
    }
}

fetchPrices();
