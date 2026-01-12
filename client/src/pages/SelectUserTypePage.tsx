import React from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../layouts/PageLayout';
import { Button } from '../components/ui/Button';
import { UserCircle, GraduationCap } from 'lucide-react';

export const SelectUserTypePage: React.FC = () => {
    return (
        <PageLayout>
            <section className="section-container min-h-[60vh] flex items-center justify-center">
                <div className="max-w-5xl mx-auto w-full">
                    <div className="text-center mb-12">
                        <h1 className="heading-lg mb-6">Welcome to EmpowerEd Learnings</h1>
                        <p className="text-xl text-gray-600">
                            Please select how you'd like to continue
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Student Option */}
                        <Link
                            to="/student-register"
                            className="group block p-8 bg-white rounded-3xl border-2 border-gray-200 hover:border-primary-500 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                        >
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-primary rounded-full mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <GraduationCap className="w-12 h-12 text-white" />
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-4">I'm a Student</h2>
                                <p className="text-gray-600 text-lg mb-6">
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
                                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-primary rounded-full mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <UserCircle className="w-12 h-12 text-white" />
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-4">I'm a Mentor</h2>
                                <p className="text-gray-600 text-lg mb-6">
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

                    <div className="text-center mt-8">
                        <p className="text-gray-600">
                            Already have an account?{' '}
                            <Link to="/login" className="text-primary-900 font-semibold hover:underline">
                                Log in here
                            </Link>
                        </p>
                    </div>
                </div>
            </section>
        </PageLayout>
    );
};

export default SelectUserTypePage;
