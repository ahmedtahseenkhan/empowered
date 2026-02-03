import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../layouts/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../api/axios';

const ForgotPasswordPage: React.FC = () => {
    const [step, setStep] = useState<'REQUEST' | 'RESET'>('REQUEST');

    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const requestCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const res = await api.post('/auth/forgot-password', { email });
            setMessage(res.data?.message || 'If an account exists for that email, a reset code has been sent.');
            setStep('RESET');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to request reset code');
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const res = await api.post('/auth/reset-password', { email, code, newPassword });
            setMessage(res.data?.message || 'Password reset successfully. You can now log in.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-md mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="heading-lg mb-4">Forgot Password</h1>
                        <p className="text-gray-600">
                            {step === 'REQUEST'
                                ? 'Enter your email to receive a 6-digit reset code.'
                                : 'Enter the 6-digit code from your email and choose a new password.'}
                        </p>
                    </div>

                    <Card>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
                                {error}
                            </div>
                        )}
                        {message && (
                            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded-lg mb-6">
                                {message}
                            </div>
                        )}

                        {step === 'REQUEST' ? (
                            <form onSubmit={requestCode} className="space-y-6">
                                <Input
                                    label="Email Address"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="your.email@example.com"
                                />

                                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
                                    {loading ? 'Sending code...' : 'Send Reset Code'}
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={resetPassword} className="space-y-6">
                                <Input
                                    label="Email Address"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="your.email@example.com"
                                />
                                <Input
                                    label="Reset Code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    required
                                    placeholder="6-digit code"
                                />
                                <Input
                                    label="New Password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    placeholder="Enter new password"
                                />

                                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
                                    {loading ? 'Resetting...' : 'Reset Password'}
                                </Button>

                                <div className="text-center text-sm text-gray-600">
                                    <button
                                        type="button"
                                        className="text-primary-900 font-semibold hover:underline"
                                        onClick={() => {
                                            setCode('');
                                            setNewPassword('');
                                            setStep('REQUEST');
                                        }}
                                    >
                                        Resend code
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600">
                                Back to{' '}
                                <Link to="/login" className="text-primary-900 font-semibold hover:underline">
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};

export default ForgotPasswordPage;
