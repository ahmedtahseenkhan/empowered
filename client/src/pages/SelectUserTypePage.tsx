import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../layouts/PageLayout';
import { Button } from '../components/ui/Button';
import { UserCircle, GraduationCap, LogIn, UserPlus } from 'lucide-react';

export const SelectUserTypePage: React.FC = () => {
    const [mode, setMode] = useState<'choose' | 'login' | 'signup'>('choose');

    return (
        <PageLayout>
            <section className="section-container min-h-[60vh] flex items-center justify-center">
                <div className="max-w-5xl mx-auto w-full">
                    <div className="text-center mb-10">
                        <h1 className="heading-lg mb-4">Welcome to EmpowerEd Learnings</h1>
                        <p className="text-lg text-gray-500">
                            How would you like to get started?
                        </p>
                    </div>

                    {/* Toggle Buttons */}
                    <div className="flex justify-center mb-10">
                        <div className="inline-flex bg-gray-100 rounded-xl p-1.5 gap-1">
                            <button
                                onClick={() => setMode('signup')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${mode === 'signup' || mode === 'choose'
                                        ? 'bg-gradient-to-r from-purple-700 to-purple-900 text-white shadow-md'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                                    }`}
                            >
                                <UserPlus className="w-4 h-4" />
                                Create Account
                            </button>
                            <button
                                onClick={() => setMode('login')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${mode === 'login'
                                        ? 'bg-gradient-to-r from-purple-700 to-purple-900 text-white shadow-md'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                                    }`}
                            >
                                <LogIn className="w-4 h-4" />
                                Log In
                            </button>
                        </div>
                    </div>

                    {/* Sign Up Flow (default) */}
                    {(mode === 'signup' || mode === 'choose') && (
                        <div className="space-y-6">
                            <p className="text-center text-gray-500">Select your role to create a new account</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Student Option */}
                                <Link
                                    to="/student-register"
                                    className="group block p-8 bg-white rounded-3xl border-2 border-gray-200 hover:border-primary-500 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                                >
                                    <div className="text-center">
                                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                                            <GraduationCap className="w-10 h-10 text-white" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-900 mb-3">I'm a Student</h2>
                                        <p className="text-gray-500 mb-6">
                                            Find expert mentors and start your learning journey
                                        </p>
                                        <div className="inline-block">
                                            <Button variant="primary" size="lg">
                                                Continue as Student
                                            </Button>
                                        </div>
                                    </div>
                                </Link>

                                {/* Mentor Option */}
                                <Link
                                    to="/tutor-register"
                                    className="group block p-8 bg-white rounded-3xl border-2 border-gray-200 hover:border-primary-500 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                                >
                                    <div className="text-center">
                                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                                            <UserCircle className="w-10 h-10 text-white" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-900 mb-3">I'm a Mentor</h2>
                                        <p className="text-gray-500 mb-6">
                                            Share your expertise and empower others to succeed
                                        </p>
                                        <div className="inline-block">
                                            <Button variant="primary" size="lg">
                                                Continue as Mentor
                                            </Button>
                                        </div>
                                    </div>
                                </Link>
                            </div>

                            <p className="text-center text-gray-500 text-sm mt-6">
                                Already have an account?{' '}
                                <button onClick={() => setMode('login')} className="text-primary-900 font-semibold hover:underline">
                                    Log in instead
                                </button>
                            </p>
                        </div>
                    )}

                    {/* Login Flow */}
                    {mode === 'login' && (
                        <div className="max-w-md mx-auto">
                            <div className="bg-white rounded-3xl border-2 border-gray-200 p-8 shadow-sm">
                                <div className="text-center mb-6">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl mb-4 shadow-lg">
                                        <LogIn className="w-8 h-8 text-white" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
                                    <p className="text-gray-500 mt-1">Sign in to continue your journey</p>
                                </div>

                                <div className="space-y-4">
                                    <Link to="/login" className="block">
                                        <Button variant="primary" size="lg" className="w-full">
                                            Go to Login Page
                                        </Button>
                                    </Link>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                                        <div className="relative flex justify-center text-xs"><span className="px-3 bg-white text-gray-400">or</span></div>
                                    </div>

                                    <p className="text-center text-gray-500 text-sm">
                                        Don't have an account?{' '}
                                        <button onClick={() => setMode('signup')} className="text-primary-900 font-semibold hover:underline">
                                            Create one now
                                        </button>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </PageLayout>
    );
};

export default SelectUserTypePage;
