import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLayout } from '../layouts/PageLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import api from '../api/axios';

const RegisterPage: React.FC = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'TUTOR' as 'STUDENT' | 'TUTOR',
    });
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
            const response = await api.post('/auth/register', formData);
            login(response.data.token, response.data.user);

            const redirect = searchParams.get('redirect');
            if (redirect) {
                navigate(redirect);
                return;
            }

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-md mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="heading-lg mb-4">Become a Mentor</h1>
                        <p className="text-gray-600">
                            Join our community of expert mentors and make a difference
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
                                label="Full Name"
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                required
                                placeholder="Your full name"
                            />

                            <Input
                                label="Email Address"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                placeholder="your.email@example.com"
                            />

                            <Input
                                label="Password"
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                placeholder="At least 6 characters"
                            />

                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <label className="block text-sm font-medium text-gray-900 mb-3">
                                    I want to join as a:
                                </label>
                                <div className="flex gap-6">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            className="h-4 w-4 text-primary-900 focus:ring-primary-500"
                                            value="STUDENT"
                                            checked={formData.role === 'STUDENT'}
                                            onChange={() => setFormData({ ...formData, role: 'STUDENT' })}
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Student</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            className="h-4 w-4 text-primary-900 focus:ring-primary-500"
                                            value="TUTOR"
                                            checked={formData.role === 'TUTOR'}
                                            onChange={() => setFormData({ ...formData, role: 'TUTOR' })}
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Mentor</span>
                                    </label>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                className="w-full"
                                disabled={loading}
                            >
                                {loading ? 'Creating account...' : 'Create Account'}
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600">
                                Already have an account?{' '}
                                <Link to="/login" className="text-primary-900 font-semibold hover:underline">
                                    Log in
                                </Link>
                            </p>
                        </div>
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};

export default RegisterPage;
