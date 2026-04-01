import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLayout } from '../layouts/PageLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Check, X, Shield, CreditCard, Mail } from 'lucide-react';
import api from '../api/axios';

const STEPS = [
    { id: 1, title: 'Basic Info', icon: <Shield className="w-5 h-5" /> },
    { id: 2, title: 'Verification', icon: <Mail className="w-5 h-5" /> },
    { id: 3, title: 'Terms', icon: <Check className="w-5 h-5" /> },
    { id: 4, title: 'Plan', icon: <CreditCard className="w-5 h-5" /> },
    { id: 5, title: 'Payment', icon: <CreditCard className="w-5 h-5" /> },
];

const TutorRegisterPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const planIdFromUrl = searchParams.get('planId');
    const stepFromUrl = searchParams.get('step');

    const [currentStep, setCurrentStep] = useState(stepFromUrl ? parseInt(stepFromUrl) : 1);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'TUTOR',
        plan: planIdFromUrl || 'STANDARD',
    });
    const [verificationCode, setVerificationCode] = useState('');
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendMessage, setResendMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [serverPlans, setServerPlans] = useState<Array<{ id: string; priceId: string; annualAmount: number }>>([]);

    const plansBase = [
        {
            id: 'STANDARD',
            defaultPriceId: 'price_1StboAByCQ0ee0A8u7BMs9cl',
            annualAmount: 300,
            name: 'Standard',
            priceLabel: '$25',
            billingLabel: '/month',
            tagline: 'For mentors building their online presence',
            highlights: [
                'Primary public mentor profile',
                '1 searchable listing (1 major category + 1 subcategory)',
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
            defaultPriceId: 'price_1StboXByCQ0ee0A8GeuDW77K',
            annualAmount: 540,
            name: 'Pro',
            priceLabel: '$45',
            billingLabel: '/month',
            tagline: 'For mentors ready to grow visibility',
            highlights: [
                'Primary public mentor profile',
                'Up to 3 searchable listings (1 major + up to 3 subcategories)',
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
            defaultPriceId: 'price_1StbozByCQ0ee0A8vJMmBvce',
            annualAmount: 1020,
            name: 'Premium',
            priceLabel: '$85',
            billingLabel: '/month',
            tagline: 'For mentors maximizing reach & revenue',
            popular: true,
            highlights: [
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

    const plans = plansBase.map((p) => {
        const server = serverPlans.find((s) => s.id === p.id);
        return {
            ...p,
            priceId: server?.priceId ?? p.defaultPriceId,
            annualAmount: server?.annualAmount ?? p.annualAmount,
        };
    });

    useEffect(() => {
        api.get('/payments/plans')
            .then((res) => setServerPlans(res.data?.plans || []))
            .catch(() => setServerPlans([]));
    }, []);

    const { login } = useAuth();

    // STEP 1: Basic Info Submission
    const handleBasicInfoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            // Register user immediately to create account
            const response = await api.post('/auth/register', {
                username: formData.username,
                email: formData.email,
                password: formData.password,
                role: 'TUTOR',
                tier: formData.plan // Send selected plan as tier
            });
            // Auto-login to get token
            login(response.data.token, response.data.user);
            setCurrentStep(2);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    // STEP 2: Verify the 6-digit code
    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setVerifyLoading(true);
        setError('');
        try {
            await api.post('/auth/verify-email-code', {
                email: formData.email,
                code: verificationCode.trim(),
            });
            setCurrentStep(3);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Invalid or expired code. Please try again.');
        } finally {
            setVerifyLoading(false);
        }
    };

    // STEP 2: Resend the verification code
    const handleResendCode = async () => {
        setResendLoading(true);
        setResendMessage('');
        setError('');
        try {
            await api.post('/auth/resend-verification', { email: formData.email });
            setVerificationCode('');
            setResendMessage('A new code has been sent to your email.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to resend code.');
        } finally {
            setResendLoading(false);
        }
    };




    // STEP 4: Plan Selection -> Activate 2-month trial (no Stripe; trial without payment)
    const handlePlanSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            await api.put('/tutor/me/tier', { tier: formData.plan });
            await api.post('/payments/mentor/subscription/activate-trial', { tier: formData.plan });
            setCurrentStep(5);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'Failed to activate trial.');
        } finally {
            setLoading(false);
        }
    };

    // STEP 5: Connect Stripe
    const handleConnectStripe = async () => {
        setLoading(true);
        try {
            const res = await api.post('/payments/mentor/onboard', {
                refreshUrl: window.location.href,
                returnUrl: `${window.location.origin}/dashboard`
            });
            if (res.data.url) {
                window.location.href = res.data.url;
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to connect Stripe.');
        } finally {
            setLoading(false);
        }
    };

    // Render Steps
    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <form onSubmit={handleBasicInfoSubmit} className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900">Create your Mentor Account</h2>
                        <Input
                            label="Full Name"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            required
                        />
                        <Input
                            label="Email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                        <Input
                            label="Password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Creating Account...' : 'Continue'}
                        </Button>
                    </form>
                );
            case 2:
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                                <Mail className="w-8 h-8 text-primary-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Verify your Email</h2>
                            <p className="text-gray-500 mt-2 text-sm">
                                We sent a 6-digit code to <strong>{formData.email}</strong>.<br />
                                Enter it below to confirm your account.
                            </p>
                        </div>

                        {resendMessage && (
                            <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
                                {resendMessage}
                            </div>
                        )}

                        <form onSubmit={handleVerifyCode} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    className="w-full text-center text-3xl font-bold tracking-widest border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                    required
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={verifyLoading || verificationCode.length !== 6}
                            >
                                {verifyLoading ? 'Verifying...' : 'Verify & Continue'}
                            </Button>
                        </form>

                        <div className="text-center text-sm text-gray-500">
                            Didn't receive a code?{' '}
                            <button
                                type="button"
                                onClick={handleResendCode}
                                disabled={resendLoading}
                                className="text-primary-600 font-semibold hover:underline disabled:opacity-50"
                            >
                                {resendLoading ? 'Sending...' : 'Resend Code'}
                            </button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900">Terms & Conditions</h2>
                        <div className="h-64 overflow-y-auto border border-gray-200 rounded-lg p-4 text-sm text-gray-600 bg-gray-50 prose prose-sm max-w-none">
                            <p className="text-gray-600 mb-4">By joining EmpowerEd Learnings as a mentor, you agree to the following:</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">1. Mentor Responsibilities</h3>
                            <p>You agree to provide professional, high-quality services, maintain respectful conduct, and honor scheduled sessions. You are responsible for your session content, communications, and clearly stating your refund or session-credit policy (if any). If a refund or session credit is issued, it must follow the Platform's policies and the terms shown to students at checkout/booking.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">2. Independent Contractor Status</h3>
                            <p>You are an independent contractor and not an employee, partner, or agent of EmpowerEd Learnings. You are responsible for your own taxes, compliance, licenses, and business obligations.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">3. Payment Structure</h3>
                            <p>Mentors keep 100% of session earnings. EmpowerEd does not take commission. Payments are processed through Stripe, and payment processing fees apply per the provider's fee structure. Payout timing is subject to the payment processor's schedule.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">4. Code of Conduct</h3>
                            <p>You must maintain professional, lawful, and respectful conduct and provide a safe learning environment. Violations, repeated complaints, or unsafe behavior, especially involving minors, may result in suspension or termination without refund.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">5. Intellectual Property</h3>
                            <p>You retain ownership of your teaching materials. You grant EmpowerEd a limited license to display your profile and related materials to operate and promote the marketplace.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">6. Cancellations</h3>
                            <p>The platform does not allow last-minute cancellations (within 24 hours of the session start time) by either students or mentors. Last-minute cancellations may result in a forfeited session and loss of payment.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">7. Termination & Subscription Cancellation</h3>
                            <p>EmpowerEd may suspend or terminate accounts immediately for violations of platform policies or safety concerns. You may cancel your subscription at any time before the next billing cycle to stop future charges. Upon cancellation/termination, you will receive payment for completed sessions processed prior to termination (subject to processor timelines), and your profile will be removed from the platform. Subscription fees are non-refundable unless required by law.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="accept-terms" className="w-4 h-4 text-primary-600 rounded" />
                            <label htmlFor="accept-terms" className="text-sm text-gray-700">I accept the Terms and Conditions</label>
                        </div>
                        <Button className="w-full" onClick={() => setCurrentStep(4)}>Accept & Continue</Button>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-center text-gray-900">Choose your Plan</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {plans.map((plan) => {
                                const selected = formData.plan === plan.id;
                                return (
                                    <button
                                        key={plan.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, plan: plan.id })}
                                        className={`relative text-left rounded-2xl border-2 bg-white p-6 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-600 ${selected
                                            ? 'border-primary-600 ring-2 ring-primary-600'
                                            : 'border-gray-200 hover:border-primary-300'
                                            }`}
                                    >
                                        {plan.popular && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                <span className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-1 text-xs font-semibold text-white shadow">
                                                    MOST POPULAR
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-lg font-bold text-gray-900">{plan.name}</div>
                                                <div className="mt-1 text-sm text-gray-500">{plan.tagline}</div>
                                            </div>
                                            {selected && (
                                                <div className="mt-1 rounded-full bg-primary-50 p-1">
                                                    <Check className="w-5 h-5 text-primary-600" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-5 flex items-baseline gap-1">
                                            <span className="text-4xl font-extrabold text-gray-900">{plan.priceLabel}</span>
                                            <span className="text-sm font-medium text-gray-600">{plan.billingLabel}</span>
                                        </div>
                                        <div className="mt-5 space-y-3">
                                            {plan.highlights.map((h) => (
                                                <div key={h} className="flex items-start gap-3">
                                                    <div className="mt-1 rounded-full bg-green-100 p-1 flex-shrink-0">
                                                        <Check className="w-3 h-3 text-green-600" />
                                                    </div>
                                                    <div className="text-sm text-gray-700 leading-snug">{h}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {plan.notIncluded?.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                                                {plan.notIncluded.map((item, idx) => (
                                                    <div key={idx} className="flex items-start gap-3">
                                                        <div className="mt-0.5 rounded-full bg-red-50 p-1 flex-shrink-0">
                                                            <X className="w-3 h-3 text-red-500" />
                                                        </div>
                                                        <div className="text-sm text-gray-500 leading-snug">{item}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <Button className="w-full" onClick={handlePlanSubmit} disabled={loading}>
                            {loading ? 'Updating Plan...' : `Continue with ${formData.plan}`}
                        </Button>
                    </div>
                );
            case 5:
                return (
                    <div className="text-center space-y-6">
                        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                            <CreditCard className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Setup Payments</h2>
                        <p className="text-gray-600">
                            Connect with Stripe to receive payouts from your students. You can do this now or later from your dashboard.
                        </p>
                        <Button
                            className="w-full bg-[#635BFF] hover:bg-[#5349E0] text-white"
                            onClick={handleConnectStripe}
                            disabled={loading}
                        >
                            {loading ? 'Connecting...' : 'Connect Stripe'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => { window.location.href = '/dashboard'; }}
                        >
                            Skip for now — go to Dashboard
                        </Button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <PageLayout>
            <section className="section-container min-h-[80vh] flex items-center justify-center bg-gray-50">
                <div className={`${currentStep === 4 ? 'max-w-6xl' : 'max-w-2xl'} mx-auto w-full`}>
                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center relative">
                            <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-0"></div>
                            {STEPS.map((step) => (
                                <div key={step.id} className={`relative z-10 flex flex-col items-center`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${currentStep >= step.id
                                        ? 'bg-primary-600 border-primary-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-400'
                                        }`}>
                                        {step.id < currentStep ? <Check className="w-5 h-5" /> : <span>{step.id}</span>}
                                    </div>
                                    <span className={`text-xs mt-2 font-medium ${currentStep >= step.id ? 'text-primary-900' : 'text-gray-400'
                                        }`}>
                                        {step.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Card className="p-8 shadow-xl">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded mb-4">
                                {error}
                            </div>
                        )}
                        {renderStepContent()}
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};

export default TutorRegisterPage;
