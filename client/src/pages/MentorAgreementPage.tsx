import React from 'react';
import { PageLayout } from '../layouts/PageLayout';

export const MentorAgreementPage: React.FC = () => {
    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-4xl mx-auto">
                    <h1 className="heading-xl mb-8 text-center">Mentor Agreement</h1>

                    <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
                        <p className="text-gray-600 leading-relaxed">
                            By joining EmpowerEd Learnings as a mentor, you agree to the following:
                        </p>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Mentor Responsibilities</h2>
                            <p>
                                You agree to provide professional, high-quality services, maintain respectful conduct, and honor scheduled sessions. You are responsible for your session content, communications, and clearly stating your refund or session-credit policy (if any). If a refund or session credit is issued, it must follow the Platform's policies and the terms shown to students at checkout/booking.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Independent Contractor Status</h2>
                            <p>
                                You are an independent contractor and not an employee, partner, or agent of EmpowerEd Learnings. You are responsible for your own taxes, compliance, licenses, and business obligations.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Payment Structure</h2>
                            <p>
                                Mentors keep 100% of session earnings. EmpowerEd does not take commission. Payments are processed through Stripe, and payment processing fees apply per the provider's fee structure. Payout timing is subject to the payment processor's schedule.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Code of Conduct</h2>
                            <p>
                                You must maintain professional, lawful, and respectful conduct and provide a safe learning environment. Violations, repeated complaints, or unsafe behavior, especially involving minors, may result in suspension or termination without refund.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Intellectual Property</h2>
                            <p>
                                You retain ownership of your teaching materials. You grant EmpowerEd a limited license to display your profile and related materials to operate and promote the marketplace.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Cancellations</h2>
                            <p>
                                The platform does not allow last-minute cancellations (within 24 hours of the session start time) by either students or mentors. Last-minute cancellations may result in a forfeited session and loss of payment.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Termination & Subscription Cancellation</h2>
                            <p>
                                EmpowerEd may suspend or terminate accounts immediately for violations of platform policies or safety concerns. You may cancel your subscription at any time before the next billing cycle to stop future charges. Upon cancellation/termination, you will receive payment for completed sessions processed prior to termination (subject to processor timelines), and your profile will be removed from the platform. Subscription fees are non-refundable unless required by law.
                            </p>
                        </section>
                    </div>
                </div>
            </section>
        </PageLayout>
    );
};

export default MentorAgreementPage;
