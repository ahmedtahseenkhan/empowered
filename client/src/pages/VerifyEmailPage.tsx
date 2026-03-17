import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageLayout } from '../layouts/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../api/axios';

const VerifyEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = (searchParams.get('token') || '').trim();

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState<string>('');

    const hasToken = useMemo(() => !!token, [token]);

    useEffect(() => {
        const run = async () => {
            if (!hasToken) {
                setStatus('error');
                setMessage('Missing verification token. Please use the link from your email.');
                return;
            }

            try {
                setStatus('loading');
                setMessage('');
                const res = await api.post('/auth/verify-email', { token });
                setStatus('success');
                setMessage(res.data?.message || 'Email verified successfully. You can now log in.');
            } catch (e: any) {
                setStatus('error');
                setMessage(e?.response?.data?.error || 'Verification failed. The link may be invalid or expired.');
            }
        };

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasToken, token]);

    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-md mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="heading-lg mb-4">Verify Email</h1>
                        <p className="text-gray-600">
                            {status === 'loading'
                                ? 'Verifying your email…'
                                : 'Confirm your email address to activate your account.'}
                        </p>
                    </div>

                    <Card>
                        {status === 'loading' && (
                            <div className="text-sm text-gray-600 text-center py-6">Please wait…</div>
                        )}

                        {status === 'success' && (
                            <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg mb-6">
                                {message}
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
                                {message}
                            </div>
                        )}

                        <div className="space-y-3">
                            <Link to="/login">
                                <Button className="w-full" variant="primary" size="lg">
                                    Go to Login
                                </Button>
                            </Link>

                            <div className="text-center text-sm text-gray-600">
                                Need a new link?{' '}
                                <Link to="/login" className="text-primary-900 font-semibold hover:underline">
                                    Try logging in
                                </Link>{' '}
                                and request a new verification email.
                            </div>
                        </div>
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};

export default VerifyEmailPage;

