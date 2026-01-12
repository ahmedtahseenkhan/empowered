import React from 'react';
import { PageLayout } from '../layouts/PageLayout';

export const MentorAgreementPage: React.FC = () => {
    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-4xl mx-auto">
                    <h1 className="heading-xl mb-8 text-center">Mentor Agreement</h1>

                    <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
                        <p className="text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Mentor Responsibilities</h2>
                            <p>
                                As a mentor on EmpowerEd Learnings, you agree to provide high-quality educational services,
                                maintain professional conduct, and adhere to scheduled sessions with students.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Payment Structure</h2>
                            <p>
                                Mentors keep 100% of their earnings. You set your own rates and payment is processed through
                                our secure payment system. Payments are typically released within 3-5 business days after
                                session completion.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Code of Conduct</h2>
                            <p>
                                Mentors must maintain professional behavior at all times, respect student privacy, and provide
                                a safe, inclusive learning environment. Any violation may result in account suspension or
                                termination.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Intellectual Property</h2>
                            <p>
                                You retain all rights to your teaching materials and content. By using our platform, you grant
                                EmpowerEd Learnings a limited license to display your profile and materials for the purpose of
                                connecting you with students.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Cancellation Policy</h2>
                            <p>
                                Mentors should provide at least 24 hours notice for session cancellations. Repeated last-minute
                                cancellations may affect your mentor rating and account standing.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Termination</h2>
                            <p>
                                Either party may terminate this agreement at any time. Upon termination, you will receive payment
                                for all completed sessions, and your profile will be removed from the platform.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Contact</h2>
                            <p>
                                For questions about this agreement, please contact us at mentors@emplearnings.com
                            </p>
                        </section>
                    </div>
                </div>
            </section>
        </PageLayout>
    );
};

export default MentorAgreementPage;
