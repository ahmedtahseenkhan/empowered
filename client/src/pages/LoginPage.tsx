import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLayout } from '../layouts/PageLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import api from '../api/axios';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/login', { email, password });
            const user = response.data.user;
            login(response.data.token, user);

            const redirect = searchParams.get('redirect');
            if (redirect) {
                navigate(redirect);
                return;
            }

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-md mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="heading-lg mb-4">Welcome Back</h1>
                        <p className="text-gray-600">
                            Sign in to continue your learning journey
                        </p>
                    </div>

                    <Card>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <Input
                                label="Email Address"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="your.email@example.com"
                            />

                            <Input
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="Enter your password"
                            />

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                className="w-full"
                                disabled={loading}
                            >
                                {loading ? 'Signing in...' : 'Sign In'}
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600">
                                Don't have an account?{' '}
                                <Link to="/select-user-type" className="text-primary-900 font-semibold hover:underline">
                                    Sign up
                                </Link>
                            </p>
                        </div>
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};

export default LoginPage;
