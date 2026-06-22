import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLayout } from '../layouts/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../api/axios';

/**
 * Standalone email-verification step shared by every signup flow (student/mentor
 * generic register, student register, find-a-mentor inline signup) and by the
 * login screen when it reports EMAIL_NOT_VERIFIED. The account is created at
 * registration but receives no token until the 6-digit code is confirmed here.
 */
const VerifyCodePage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const email = (searchParams.get('email') || '').trim();
    const redirect = searchParams.get('redirect') || '';

    const { login } = useAuth();
    const navigate = useNavigate();

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const res = await api.post('/auth/verify-email-code', { email, code: code.trim() });
            if (res.data?.token && res.data?.user) {
                login(res.data.token, res.data.user);
                navigate(redirect || '/dashboard');
            } else {
                // Already verified or no token returned — send them to log in.
                navigate('/login');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Invalid or expired code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError('');
        setMessage('');
        setResendLoading(true);
        try {
            await api.post('/auth/resend-verification', { email });
            setCode('');
            setMessage('A new code has been sent to your email.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to resend code.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-md mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="heading-lg mb-4">Verify Your Email</h1>
                        <p className="text-gray-600">
                            {email
                                ? <>We sent a 6-digit code to <span className="font-semibold">{email}</span>. Enter it below to activate your account.</>
                                : 'Enter the 6-digit code we emailed you to activate your account.'}
                        </p>
                    </div>

                    <Card>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
                                {error}
                            </div>
                        )}
                        {message && (
                            <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg mb-6">
                                {message}
                            </div>
                        )}

                        {!email ? (
                            <div className="text-sm text-gray-600 text-center py-4">
                                Missing email address.{' '}
                                <Link to="/register" className="text-primary-900 font-semibold hover:underline">
                                    Go back to sign up
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleVerify} className="space-y-6">
                                <Input
                                    label="Verification Code"
                                    type="text"
                                    inputMode="numeric"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    required
                                    placeholder="123456"
                                    maxLength={6}
                                />

                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    className="w-full"
                                    disabled={loading || code.trim().length === 0}
                                >
                                    {loading ? 'Verifying...' : 'Verify & Continue'}
                                </Button>

                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={handleResend}
                                        disabled={resendLoading}
                                        className="text-sm text-primary-900 font-semibold hover:underline disabled:opacity-50"
                                    >
                                        {resendLoading ? 'Sending...' : "Didn't get a code? Resend"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};

export default VerifyCodePage;
