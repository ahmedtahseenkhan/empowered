import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLayout } from '../layouts/PageLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Check, Shield, CreditCard, Mail } from 'lucide-react';
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

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'TUTOR',
        plan: planIdFromUrl || 'STANDARD',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const plans = [
        {
            id: 'STANDARD',
            name: 'Standard',
            priceLabel: '$85',
            billingLabel: '/month',
            tagline: 'Basic profile & listings',
            highlights: [
                'Custom profile page',
                'Personal dashboard',
                'Scheduling & reminders',
                'Stripe recurring payments',
                '1-Month Free Trial',
            ],
        },
        {
            id: 'PRO',
            name: 'Pro',
            priceLabel: '$65',
            billingLabel: '/month',
            tagline: 'Featured listings + Analytics',
            highlights: [
                'Everything in Standard',
                'Featured profile visibility',
                'Advanced marketing support',
                'Analytics insights',
                '1-Month Free Trial',
            ],
        },
        {
            id: 'PREMIUM',
            name: 'Premium',
            priceLabel: '$50',
            billingLabel: '/month',
            tagline: 'Verified badge + Top placement',
            popular: true,
            highlights: [
                'Everything in Pro',
                'Verified badge',
                'Top placement',
                'Multiple categories',
                '1-Month Free Trial',
            ],
        },
    ];

    const { login } = useAuth();
    const navigate = useNavigate();

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

    // STEP 4: Plan Selection Submission
    const handlePlanSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            await api.put('/tutor/me/tier', { tier: formData.plan });
            setCurrentStep(5);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'Failed to update plan.');
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
                    <div className="text-center space-y-6">
                        <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                            <Mail className="w-8 h-8 text-primary-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Verify your Email</h2>
                        <p className="text-gray-600">
                            We've sent a verification link to <strong>{formData.email}</strong>.
                            Please check your inbox.
                        </p>
                        <Button
                            variant="primary"
                            className="w-full"
                            onClick={() => setCurrentStep(3)} // Simulated verification
                        >
                            I've Verified My Email
                        </Button>
                        <button className="text-sm text-gray-500 hover:text-primary-600 underline">Resend Link</button>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900">Terms & Conditions</h2>
                        <div className="h-64 overflow-y-auto border border-gray-200 rounded-lg p-4 text-sm text-gray-600 bg-gray-50 prose prose-sm max-w-none">
                            <p className="text-xs text-gray-500 mb-4">Last updated: {new Date().toLocaleDateString()}</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">1. Mentor Responsibilities</h3>
                            <p>As a mentor on EmpowerEd Learnings, you agree to provide high-quality educational services, maintain professional conduct, and adhere to scheduled sessions with students.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">2. Payment Structure</h3>
                            <p>Mentors keep 100% of their earnings. You set your own rates and payment is processed through our secure payment system. Payments are typically released within 3-5 business days after session completion.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">3. Code of Conduct</h3>
                            <p>Mentors must maintain professional behavior at all times, respect student privacy, and provide a safe, inclusive learning environment. Any violation may result in account suspension or termination.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">4. Intellectual Property</h3>
                            <p>You retain all rights to your teaching materials and content. By using our platform, you grant EmpowerEd Learnings a limited license to display your profile and materials for the purpose of connecting you with students.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">5. Cancellation Policy</h3>
                            <p>Mentors should provide at least 24 hours notice for session cancellations. Repeated last-minute cancellations may affect your mentor rating and account standing.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">6. Termination</h3>
                            <p>Either party may terminate this agreement at any time. Upon termination, you will receive payment for all completed sessions, and your profile will be removed from the platform.</p>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">7. Contact</h3>
                            <p>For questions about this agreement, please contact us at mentors@emplearnings.com</p>
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
                            Connect with Stripe to receive payouts from your students.
                        </p>
                        <Button
                            className="w-full bg-[#635BFF] hover:bg-[#5349E0] text-white"
                            onClick={() => navigate('/tutor-onboarding')}
                        >
                            Connect Stripe
                        </Button>
                        <button
                            onClick={() => navigate('/tutor-onboarding')}
                            className="text-sm text-gray-500 hover:text-gray-700 underline"
                        >
                            Skip for now
                        </button>
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
