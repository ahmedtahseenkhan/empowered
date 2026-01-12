import React from 'react';
import { PageLayout } from '../layouts/PageLayout';

export const TermsOfServicePage: React.FC = () => {
    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-4xl mx-auto">
                    <h1 className="heading-xl mb-8 text-center">Terms of Service</h1>

                    <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
                        <p className="text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
                            <p>
                                By accessing and using EmpowerEd Learnings, you accept and agree to be bound by the terms
                                and provision of this agreement. If you do not agree to these terms, please do not use our service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Use License</h2>
                            <p>
                                Permission is granted to temporarily access the materials on EmpowerEd Learnings for personal,
                                non-commercial use only. This is the grant of a license, not a transfer of title.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. User Accounts</h2>
                            <p>
                                When you create an account with us, you must provide accurate, complete, and current information.
                                Failure to do so constitutes a breach of the Terms, which may result in immediate termination of
                                your account.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Payment Terms</h2>
                            <p>
                                All payments are processed securely through our payment partners. Refund policies vary by mentor
                                and service type. Please review the specific terms before booking a session.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Limitation of Liability</h2>
                            <p>
                                EmpowerEd Learnings shall not be held liable for any indirect, incidental, special, consequential,
                                or punitive damages resulting from your use of or inability to use the service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Contact Information</h2>
                            <p>
                                If you have any questions about these Terms, please contact us at legal@emplearnings.com
                            </p>
                        </section>
                    </div>
                </div>
            </section>
        </PageLayout>
    );
};

export default TermsOfServicePage;
