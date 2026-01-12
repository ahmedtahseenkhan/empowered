import React, { useState, useEffect } from 'react';
import { Crown, Check, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DashboardLayout } from '../layouts/DashboardLayout';
import api from '../api/axios';

interface TutorProfile {
    tier: 'STANDARD' | 'PRO' | 'PREMIUM';
    username: string;
}

const plans = [
    {
        id: 'STANDARD',
        name: 'Standard',
        price: '$35',
        billing: '/month (Billed annually)',
        description: 'For those seeking a strong online presence',
        features: [
            'Public mentor profile (searchable)',
            'Session scheduling & rescheduling',
            'Weekly recurring session setup',
            'Secure payments with weekly billing',
            'Automated email reminders',
            'Dedicated meeting link for each session',
            'Student portal access',
            'Mentor dashboard',
            'Platform onboarding & support',
            '1-month free trial',
        ],
        notIncluded: [
            'Featured mentor badge & priority placement',
            'Social media promotion',
            'Paid ads for individual mentors',
            'Sell pre-recorded courses',
            'Cannot list services in multiple categories',
        ],
    },
    {
        id: 'PRO',
        name: 'Pro',
        price: '$65',
        billing: '/month (Billed annually)',
        description: 'For the growing business ready to scale',
        popular: true,
        features: [
            'Public mentor profile with intro video',
            'Session scheduling & rescheduling',
            'Weekly recurring session setup',
            'Secure payments with weekly billing',
            'Automated email reminders',
            'Dedicated meeting link for each session',
            'Student portal access',
            'Mentor dashboard',
            'AI-assisted lesson planning',
            'Featured mentor listing on marketplace',
            'Featured mentor badge',
            'Social media spotlight',
            'Profile performance insights (views & clicks)',
            'Platform onboarding & support',
            '1-month free trial',
        ],
        notIncluded: [
            'Paid ads for individual mentors',
            'Sell pre-recorded courses',
            'Cannot list services in multiple categories',
        ],
    },
    {
        id: 'PREMIUM',
        name: 'Premium',
        price: '$135',
        billing: '/month (Billed annually)',
        description: 'For those looking to diversify their reach and maximize revenue',
        features: [
            'Premium mentor profile design',
            'Session scheduling & rescheduling',
            'Weekly recurring session setup',
            'Secure payments with weekly billing',
            'Automated email reminders',
            'Dedicated meeting link for each session',
            'Student portal access',
            'Mentor dashboard',
            'AI-assisted lesson planning',
            'Featured mentor listing on marketplace',
            'Monthly social media spotlight',
            'Sell pre-recorded courses',
            'Featured mentor badge',
            'Ability to list services in multiple categories',
            'Profile performance insights',
            'Priority onboarding & support',
            '1-month free trial',
        ],
        notIncluded: [],
    },
];

const SubscriptionSettingsPage: React.FC = () => {
    const [profile, setProfile] = useState<TutorProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCancelModal, setShowCancelModal] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await api.get('/tutor/me');
            setProfile(response.data);
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const currentPlan = plans.find(p => p.id === profile?.tier);
    const otherPlans = plans.filter(p => p.id !== profile?.tier);

    const handleChangePlan = (planId: string) => {
        // TODO: Implement plan change logic with Stripe
        alert(`Plan change to ${planId} will be implemented with Stripe integration`);
    };

    const handleCancelSubscription = () => {
        setShowCancelModal(true);
    };

    const confirmCancellation = async () => {
        // TODO: Implement cancellation logic with Stripe
        alert('Subscription cancellation will be implemented with Stripe integration');
        setShowCancelModal(false);
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-900 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading subscription details...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="w-full">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-[#4A1D96] mb-2">Subscription Settings</h1>
                    <p className="text-gray-600">Manage your subscription plan and billing</p>
                </div>

                {/* Current Plan */}
                <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Current Plan</h2>
                            <p className="text-gray-600">You are currently on the {currentPlan?.name} plan</p>
                        </div>
                        {currentPlan?.id === 'PREMIUM' && (
                            <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-4 py-2 rounded-full">
                                <Crown size={20} />
                                <span className="font-semibold">Premium Member</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-300">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-[#4A1D96] mb-1">{currentPlan?.name} Plan</h3>
                                <p className="text-gray-700">{currentPlan?.description}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-bold text-[#4A1D96]">{currentPlan?.price}</div>
                                <div className="text-sm text-gray-600">{currentPlan?.billing}</div>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Included Features:</h4>
                                <ul className="space-y-2">
                                    {currentPlan?.features.slice(0, 8).map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-3">&nbsp;</h4>
                                <ul className="space-y-2">
                                    {currentPlan?.features.slice(8).map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Button
                                variant="outline"
                                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                                onClick={handleCancelSubscription}
                            >
                                Cancel Subscription
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Other Plans */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        {currentPlan?.id === 'PREMIUM' ? 'Downgrade Options' : 'Upgrade Your Plan'}
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        {otherPlans.map((plan) => (
                            <div
                                key={plan.id}
                                className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow p-6 relative"
                            >
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 rounded-full text-xs font-semibold shadow">
                                            MOST POPULAR
                                        </span>
                                    </div>
                                )}

                                <div className="mb-4">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                                    <p className="text-gray-600 text-sm mb-3">{plan.description}</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-bold text-[#4A1D96]">{plan.price}</span>
                                        <span className="text-gray-600">{plan.billing}</span>
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <h4 className="font-semibold text-gray-900 mb-3 text-sm">What's Included:</h4>
                                    <ul className="space-y-2">
                                        {plan.features.slice(0, 6).map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                        {plan.features.length > 6 && (
                                            <li className="text-sm text-[#4A1D96] font-medium">
                                                + {plan.features.length - 6} more features
                                            </li>
                                        )}
                                    </ul>
                                </div>

                                <Button
                                    className={`w-full ${plan.id === 'PREMIUM'
                                        ? 'bg-gradient-to-r from-purple-600 to-purple-900'
                                        : 'bg-[#4A1D96]'
                                        } text-white`}
                                    onClick={() => handleChangePlan(plan.id)}
                                >
                                    {plan.id > currentPlan?.id! ? 'Upgrade' : 'Downgrade'} to {plan.name}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Billing Info Notice */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-blue-900 mb-1">Payment Integration Coming Soon</h3>
                            <p className="text-blue-800 text-sm">
                                Stripe payment integration is currently in development. You'll be able to manage your
                                subscription, update payment methods, and view billing history once it's live.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cancel Subscription Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Cancel Subscription</h2>
                        <p className="text-xl text-gray-700 mb-6">
                            Are you sure you want to cancel your subscription?
                        </p>

                        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mb-6">
                            <div className="mb-4">
                                <p className="text-gray-800 mb-2">
                                    <strong>Upcoming Payment:</strong> {currentPlan?.price} (billed annually)
                                </p>
                                <p className="text-gray-800">
                                    <strong>Next Billing Date:</strong> January 31, 2026
                                </p>
                            </div>

                            <div className="bg-yellow-100 border-l-4 border-yellow-600 p-4 rounded flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                                <p className="text-yellow-900 text-sm">
                                    <strong>To avoid extra charges, please cancel before your next billing cycle.</strong>
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setShowCancelModal(false)}
                            >
                                Keep Subscription
                            </Button>
                            <Button
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                onClick={confirmCancellation}
                            >
                                Yes, Cancel Subscription
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default SubscriptionSettingsPage;
