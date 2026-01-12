import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageLayout } from '../layouts/PageLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export const StudentRegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        // Clear error when user starts typing
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: '' });
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.fullName.trim()) {
            newErrors.fullName = 'Full name is required';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setSubmitError('');

        if (!validateForm()) {
            return;
        }

        try {
            setSubmitting(true);
            const response = await api.post('/auth/register', {
                username: formData.fullName.trim(),
                email: formData.email.trim(),
                password: formData.password,
                role: 'STUDENT',
            });

            login(response.data.token, response.data.user);
            navigate('/dashboard');
        } catch (err: any) {
            setSubmitError(err.response?.data?.error || 'Registration failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleSignIn = () => {
        // TODO: Implement Google OAuth
        console.log('Google sign in clicked');
    };

    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-md mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="heading-lg mb-4">Create Your Student Account</h1>
                        <p className="text-gray-600">
                            Start your learning journey with EmpowerEd Learnings
                        </p>
                    </div>

                    <Card>
                        {submitError && (
                            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
                                {submitError}
                            </div>
                        )}
                        {/* Google Sign In */}
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors mb-6"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            <span className="font-medium text-gray-700">Continue with Google</span>
                        </button>

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">Or register with email</span>
                            </div>
                        </div>

                        {/* Registration Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="Full Name"
                                name="fullName"
                                type="text"
                                value={formData.fullName}
                                onChange={handleChange}
                                error={errors.fullName}
                                placeholder="John Doe"
                            />

                            <Input
                                label="Email Address"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                error={errors.email}
                                placeholder="john@example.com"
                            />

                            <Input
                                label="Password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                error={errors.password}
                                placeholder="At least 6 characters"
                            />

                            <Input
                                label="Confirm Password"
                                name="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                error={errors.confirmPassword}
                                placeholder="Re-enter your password"
                            />

                            <Button type="submit" variant="primary" size="lg" className="w-full mt-6">
                                {submitting ? 'Creating...' : 'Create Account'}
                            </Button>
                        </form>

                        <p className="text-center text-sm text-gray-600 mt-6">
                            Already have an account?{' '}
                            <Link to="/login" className="text-primary-900 font-semibold hover:underline">
                                Log in
                            </Link>
                        </p>
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};

export default StudentRegisterPage;
