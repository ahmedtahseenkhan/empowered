import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn("WARNING: STRIPE_SECRET_KEY is missing from environment variables.");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2024-12-18.acacia' as any, // Use latest or matching version
});

export class StripeService {

    /**
     * Create a Connect Account for a Mentor
     * @param email - Email address for the Connect account
     * @param country - Country code (default: 'US')
     */
    static async createConnectAccount(email: string, country: string = 'US') {
        try {
            const capabilities: Stripe.AccountCreateParams.Capabilities = {
                transfers: { requested: true },
            };

            // 'card_payments' is not supported for Express accounts in Oman (and some other regions)
            // They primarily support 'transfers' (payouts) for Cross-Border or local setups.
            if (country !== 'OM') {
                capabilities.card_payments = { requested: true };
            }

            const accountCreateParams: Stripe.AccountCreateParams = {
                type: 'express',
                country,
                email,
                capabilities,
            };

            // Oman requires the recipient service agreement when requesting transfers capability.
            // https://stripe.com/docs/connect/service-agreement-types#choosing-type-with-api
            if (country === 'OM') {
                accountCreateParams.tos_acceptance = {
                    service_agreement: 'recipient',
                };
            }

            const account = await stripe.accounts.create(accountCreateParams);
            return account;
        } catch (error: any) {
            console.error('Error creating connect account:', error);

            // Provide helpful error messages for common issues
            if (error.code === 'country_unsupported') {
                throw new Error(`Stripe Connect is not available in ${country}. Please contact support.`);
            }

            throw new Error(error.message || 'Failed to create Stripe Connect account');
        }
    }

    /**
     * Generate an Account Link for onboarding
     */
    static async createAccountLink(accountId: string, refreshUrl: string, returnUrl: string) {
        try {
            const accountLink = await stripe.accountLinks.create({
                account: accountId,
                refresh_url: refreshUrl,
                return_url: returnUrl,
                type: 'account_onboarding',
            });
            return accountLink.url;
        } catch (error: any) {
            console.error('Error creating account link:', error);
            throw new Error(error.message || 'Failed to create onboarding link');
        }
    }

    /**
     * Get Connect Account details and status
     */
    static async getConnectAccount(accountId: string) {
        try {
            const account = await stripe.accounts.retrieve(accountId);
            return account;
        } catch (error: any) {
            console.error('Error retrieving connect account:', error);
            throw new Error(error.message || 'Failed to retrieve account details');
        }
    }

    /**
     * Create a Customer for a Student
     */
    static async createCustomer(email: string, name: string) {
        try {
            const customer = await stripe.customers.create({
                email,
                name,
            });
            return customer;
        } catch (error) {
            console.error('Error creating customer:', error);
            throw error;
        }
    }

    /**
     * Create a Checkout Session for Mentor Subscription (Standard, Pro, Premium)
     */
    static async createSubscriptionCheckoutSession(
        priceId: string,
        customerId: string,
        successUrl: string,
        cancelUrl: string,
        metadata: any = {},
        trialEligible: boolean = false
    ) {
        try {
            const normalizedMetadata: Record<string, string> = Object.fromEntries(
                Object.entries(metadata || {})
                    .filter(([, v]) => v !== undefined && v !== null)
                    .map(([k, v]) => [k, String(v)])
            );

            const subscriptionData: any = {
                metadata: normalizedMetadata,
            };

            // Trial is intentionally disabled for paid annual checkout copy.

            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                subscription_data: subscriptionData,
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: normalizedMetadata,
                client_reference_id: normalizedMetadata.tutorId,
            });
            return session;
        } catch (error) {
            console.error('Error creating subscription checkout session:', error);
            throw error;
        }
    }

    /**
     * Create Checkout Session for Student Booking (Destination Charge)
     */
    static async createBookingCheckoutSession(
        amount: number, // in cents
        currency: string = 'usd',
        customerId: string,
        mentorConnectId: string,
        platformFee: number, // in cents
        successUrl: string,
        cancelUrl: string,
        metadata: any = {}
    ) {
        try {
            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                mode: 'payment', // Or 'subscription' if weekly recurring
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: currency,
                            product_data: {
                                name: 'Mentorship Session',
                            },
                            unit_amount: amount,
                        },
                        quantity: 1,
                    },
                ],
                payment_intent_data: {
                    application_fee_amount: platformFee,
                    transfer_data: {
                        destination: mentorConnectId,
                    },
                },
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata,
            });
            return session;
        } catch (error) {
            console.error('Error creating booking checkout session:', error);
            throw error;
        }
    }

    static async getSubscription(subscriptionId: string) {
        return stripe.subscriptions.retrieve(subscriptionId);
    }

    /**
     * Cancel a Subscription at period end (so user keeps access until the current paid period expires)
     */
    static async cancelSubscription(subscriptionId: string) {
        try {
            const subscription = await stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true,
            });
            return subscription;
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            throw error;
        }
    }

    /**
     * Cancel a Subscription immediately
     */
    static async cancelSubscriptionImmediately(subscriptionId: string) {
        try {
            const subscription = await stripe.subscriptions.cancel(subscriptionId);
            return subscription;
        } catch (error) {
            console.error('Error cancelling subscription immediately:', error);
            throw error;
        }
    }

    static async getCheckoutSessionByPaymentIntent(paymentIntentId: string) {
        const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntentId,
            limit: 1,
        });
        return sessions.data[0] || null;
    }

    static async getCheckoutSessionById(sessionId: string) {
        return stripe.checkout.sessions.retrieve(sessionId);
    }

    static constructEvent(payload: string | Buffer, sig: string, endpointSecret: string) {
        return stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    }

    /**
     * Update Subscription (Upgrade/Downgrade)
     */
    static async updateSubscription(subscriptionId: string, newPriceId: string) {
        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const itemId = subscription.items.data[0].id;

            const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
                items: [{
                    id: itemId,
                    price: newPriceId,
                }],
                proration_behavior: 'create_prorations', // Default behavior usually fine
            });
            return updatedSubscription;
        } catch (error) {
            console.error('Error updating subscription:', error);
            throw error;
        }
    }
}
