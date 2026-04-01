import React, { useState, useEffect } from 'react';
import { Crown, Check, X, AlertTriangle, Sparkles, Zap, Shield } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';

interface TutorProfile {
    tier: 'STANDARD' | 'PRO' | 'PREMIUM';
    username?: string;
    stripe_subscription_id?: string | null;
    subscription_status?: string | null;
    subscription_end_date?: string | null;
    has_used_trial?: boolean;
}

type ServerPlan = { id: string; name: string; priceMonthly: number; annualAmount: number; priceId: string };

const plansConfig = [
    {
        id: 'STANDARD',
        name: 'Standard',
        price: '$25',
        billing: '/month',
        billingNote: 'Billed annually',
        description: 'For mentors building their online presence',
        defaultPriceId: 'price_1StboAByCQ0ee0A8u7BMs9cl',
        annualAmount: 300,
        icon: Shield,
        gradient: 'from-slate-500 to-slate-700',
        accentColor: 'slate',
        features: [
            'Primary public mentor profile',
            '1 searchable listing (listed in 1 major category + 1 subcategory)',
            'Online scheduling & session management',
            'Weekly recurring session setup',
            'Secure student payments (weekly billing)',
            'Automated email reminders',
            'Dedicated meeting link for each session',
            'Student portal access',
            'Mentor dashboard',
            'Platform onboarding & support',
            '2-month free trial',
        ],
        notIncluded: [
            'Marketplace boost',
            'Intro video on profile',
            'Profile highlights & outside reviews',
            'Social media promotion',
            'Dedicated ad placement',
            'AI-assisted lesson planning',
            'Sell pre-recorded courses',
            'Profile performance insights',
        ],
    },
    {
        id: 'PRO',
        name: 'Pro',
        price: '$45',
        billing: '/month',
        billingNote: 'Billed annually',
        description: 'For mentors ready to grow visibility',
        popular: true,
        defaultPriceId: 'price_1StboXByCQ0ee0A8GeuDW77K',
        annualAmount: 540,
        icon: Zap,
        gradient: 'from-purple-600 to-indigo-600',
        accentColor: 'purple',
        features: [
            'Primary public mentor profile',
            'Up to 3 searchable listings (1 major category + up to 3 subcategories)',
            'Featured mentor badge + marketplace boost',
            'Intro video on public profile',
            'Profile highlights + outside reviews',
            'Monthly social media spotlight',
            'Profile performance insights (views & clicks)',
            'Online scheduling & session management',
            'Weekly recurring session setup',
            'Secure student payments (weekly billing)',
            'Automated email reminders',
            'Dedicated meeting link for each session',
            'Student portal access',
            'Mentor dashboard',
            'Platform onboarding & support',
            '2-month free trial',
        ],
        notIncluded: [
            'Weekly promotion',
            'Dedicated ad placement',
            'AI-assisted lesson planning',
            'Multiple Major Categories',
        ],
    },
    {
        id: 'PREMIUM',
        name: 'Premium',
        price: '$85',
        billing: '/month',
        billingNote: 'Billed annually',
        description: 'Maximize your reach & revenue',
        defaultPriceId: 'price_1StbozByCQ0ee0A8vJMmBvce',
        annualAmount: 1020,
        icon: Crown,
        gradient: 'from-amber-500 to-orange-600',
        accentColor: 'amber',
        features: [
            'Primary public mentor profile',
            'Multiple searchable listings (up to 3 major categories + 3 subcategories)',
            'Maximum marketplace visibility',
            'Featured mentor badge + priority placement',
            'Intro video on profile',
            'Weekly social media highlight',
            'Weekly dedicated ad placement (platform channel)',
            'AI-assisted lesson planning (templates + outlines)',
            'Sell pre-recorded courses',
            'Profile performance insights',
            'Priority onboarding & support',
            'Online scheduling & session management',
            'Weekly recurring session setup',
            'Secure student payments (weekly billing)',
            'Automated email reminders',
            'Dedicated meeting link for each session',
            'Student portal access',
            '2-month free trial',
        ],
        notIncluded: [],
    },
];

const planRank: Record<string, number> = {
    'STANDARD': 1,
    'PRO': 2,
    'PREMIUM': 3,
};

const SubscriptionSettingsPage: React.FC = () => {
    const [profile, setProfile] = useState<TutorProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
    const [serverPlans, setServerPlans] = useState<ServerPlan[] | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session_id');
        if (sessionId) {
            // Remove query params from URL without reloading
            window.history.replaceState({}, '', window.location.pathname);
            api.post('/payments/mentor/subscription/finalize', { sessionId })
                .catch((err) => console.warn('Finalize subscription error:', err))
                .finally(() => fetchProfile());
        } else {
            fetchProfile();
        }
    }, []);

    useEffect(() => {
        api.get('/payments/plans')
            .then((res) => setServerPlans(res.data?.plans || []))
            .catch(() => setServerPlans(null));
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await api.get('/payments/mentor/status');
            setProfile(response.data);
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const status = profile?.subscription_status || null;
    const endDate = profile?.subscription_end_date ? new Date(profile.subscription_end_date) : null;
    const hasValidEnd = !!endDate && !Number.isNaN(endDate.getTime());
    const daysLeft = hasValidEnd ? Math.ceil((endDate!.getTime() - Date.now()) / (1000 * 3600 * 24)) : null;
    const expired = daysLeft !== null && daysLeft <= 0;

    const hasStripeSubscription = !!profile?.stripe_subscription_id;
    const isActiveOrTrial = status === 'active' || status === 'trialing';
    // Allow access for trialing/active with valid end date even without Stripe (e.g. trial activated without payment)
    const paymentRequired = !isActiveOrTrial || !hasValidEnd || expired;

    const plans = plansConfig.map((c) => {
        const server = serverPlans?.find((s) => s.id === c.id);
        return {
            ...c,
            priceId: server?.priceId ?? c.defaultPriceId,
            annualAmount: server?.annualAmount ?? c.annualAmount,
        };
    });

    const currentPlan = plans.find(p => p.id === profile?.tier);

    const handleChangePlan = async (planId: string, priceId: string | undefined) => {
        try {
            setLoading(true);
            // If they have a Stripe subscription, update via Stripe
            if (!paymentRequired && profile?.stripe_subscription_id && priceId) {
                await api.put('/payments/mentor/subscription', {
                    newPriceId: priceId,
                    tier: planId
                });
                await fetchProfile();
                alert('Subscription updated successfully!');
            } else if (!profile?.has_used_trial) {
                // First-time user: activate free trial without payment
                await api.post('/payments/mentor/subscription/activate-trial', { tier: planId });
                await fetchProfile();
                alert('Your free trial has been activated!');
            } else {
                // Trial already used: redirect to Stripe checkout for paid subscription
                if (!priceId) {
                    alert('Unable to determine plan price. Please try again.');
                    return;
                }
                const response = await api.post('/payments/mentor/subscription', {
                    priceId,
                    tier: planId,
                    successUrl: `${window.location.origin}/dashboard/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
                    cancelUrl: `${window.location.origin}/dashboard/subscription?canceled=true`,
                });
                if (response.data?.url) {
                    window.location.href = response.data.url;
                }
            }
        } catch (error: any) {
            console.error('Failed to update plan:', error);
            alert(error.response?.data?.error || 'Failed to update subscription.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelSubscription = () => {
        setShowCancelModal(true);
    };

    const confirmCancellation = async () => {
        try {
            setLoading(true);
            await api.post('/payments/mentor/subscription/cancel');
            await fetchProfile();
            alert('Your subscription has been canceled.');
        } catch (error: any) {
            console.error('Failed to cancel subscription:', error);
            alert(error.response?.data?.error || 'Failed to cancel subscription.');
        } finally {
            setShowCancelModal(false);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-900 rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-gray-500 text-sm">Loading subscription details...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="w-full max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Subscription Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your subscription plan and billing</p>
                </div>

                {/* Alert: Subscription Required */}
                {paymentRequired && (
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-red-800">Subscription Required</h2>
                            <p className="text-xs text-red-700 mt-0.5">
                                {!profile?.has_used_trial
                                    ? 'Start your subscription to activate your free trial and access mentor features.'
                                    : expired
                                        ? 'Your trial/subscription period has ended. Subscribe to a plan to continue.'
                                        : 'Your subscription is not active. Please select a plan to continue.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Current Plan Summary (compact, only when has active sub) */}
                {!paymentRequired && currentPlan && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${currentPlan.gradient} flex items-center justify-center`}>
                                    <currentPlan.icon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-semibold text-gray-900">{currentPlan.name} Plan</h2>
                                        {status === 'trialing' && (
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Trial</span>
                                        )}
                                        {isActiveOrTrial && !expired && (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {currentPlan.price}{currentPlan.billing} · {currentPlan.billingNote}
                                        {daysLeft !== null && !expired && (
                                            <> · <span className="font-medium">{daysLeft} days</span> remaining</>
                                        )}
                                    </p>
                                </div>
                            </div>
                            {hasStripeSubscription && (
                                <button
                                    onClick={handleCancelSubscription}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Plans Grid */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">
                        {paymentRequired
                            ? 'Choose Your Plan'
                            : 'Available Plans'}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {plans.map((plan) => {
                            const isCurrentPlan = plan.id === profile?.tier && !paymentRequired;
                            const isUpgrade = planRank[plan.id] > planRank[currentPlan?.id || 'STANDARD'];
                            const isExpanded = expandedPlan === plan.id;
                            const Icon = plan.icon;

                            return (
                                <div
                                    key={plan.id}
                                    className={`relative bg-white rounded-xl border-2 transition-all duration-300 hover:shadow-md ${plan.popular && !isCurrentPlan
                                        ? 'border-purple-400 shadow-sm'
                                        : isCurrentPlan
                                            ? 'border-green-400 bg-green-50/30'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {/* Popular badge */}
                                    {plan.popular && !isCurrentPlan && (
                                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                                            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-sm flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" /> MOST POPULAR
                                            </span>
                                        </div>
                                    )}

                                    {/* Current plan badge */}
                                    {isCurrentPlan && (
                                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                                            <span className="bg-green-600 text-white px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-sm">
                                                CURRENT PLAN
                                            </span>
                                        </div>
                                    )}

                                    <div className="p-5">
                                        {/* Plan header */}
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${plan.gradient} flex items-center justify-center flex-shrink-0`}>
                                                <Icon className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">{plan.name}</h3>
                                                <p className="text-xs text-gray-500">{plan.description}</p>
                                            </div>
                                        </div>

                                        {/* Price */}
                                        <div className="mb-4">
                                            <div className="flex items-baseline gap-0.5">
                                                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                                                <span className="text-sm text-gray-500">{plan.billing}</span>
                                            </div>
                                            <p className="text-[11px] text-gray-400">{plan.billingNote}</p>
                                        </div>

                                        {/* Features (included) */}
                                        <div className="mb-3">
                                            <ul className="space-y-1.5">
                                                {plan.features.slice(0, isExpanded ? undefined : 5).map((feature, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                                                        <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                                                        <span>{feature}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {plan.features.length > 5 && (
                                                <button
                                                    onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                                                    className="text-[11px] text-purple-600 font-medium mt-2 hover:underline"
                                                >
                                                    {isExpanded ? 'Show less' : `+${plan.features.length - 5} more features`}
                                                </button>
                                            )}
                                        </div>
                                        {plan.notIncluded.length > 0 && (
                                            <>
                                                <ul className="space-y-1.5 pt-2 border-t border-gray-100">
                                                    {plan.notIncluded.slice(0, isExpanded ? undefined : 4).map((feature, idx) => (
                                                        <li key={`not-${idx}`} className="flex items-start gap-2 text-xs text-gray-500">
                                                            <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                                                            <span>{feature}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                {plan.notIncluded.length > 4 && (
                                                    <button
                                                        onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                                                        className="text-[11px] text-gray-500 font-medium mt-1 hover:underline"
                                                    >
                                                        {isExpanded ? 'Show less' : `+${plan.notIncluded.length - 4} more`}
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {/* CTA Button */}
                                        {isCurrentPlan ? (
                                            <div className="w-full py-2 text-center text-xs font-medium text-green-700 bg-green-100 rounded-lg">
                                                Your Current Plan
                                            </div>
                                        ) : (
                                            <Button
                                                size="sm"
                                                className={`w-full text-sm ${plan.popular
                                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                                                    : plan.id === 'PREMIUM'
                                                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white'
                                                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                                                    }`}
                                                onClick={() => handleChangePlan(plan.id, plan.priceId)}
                                            >
                                                {paymentRequired
                                                    ? (!profile?.has_used_trial ? `Start Free Trial` : `Subscribe to ${plan.name}`)
                                                    : (isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`)}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Info banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                        Subscription status is synced from Stripe. If you just paid, refresh in a few seconds.
                    </p>
                </div>
            </div>

            {/* Cancel Subscription Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel Subscription</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Are you sure you want to cancel your subscription?
                        </p>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-800">
                                    <p className="mb-1"><strong>Upcoming:</strong> {currentPlan?.name} (billed annually)</p>
                                    <p><strong>Warning:</strong> Cancel before your next billing cycle to avoid charges.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => setShowCancelModal(false)}
                            >
                                Keep Plan
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                onClick={confirmCancellation}
                            >
                                Yes, Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default SubscriptionSettingsPage;
