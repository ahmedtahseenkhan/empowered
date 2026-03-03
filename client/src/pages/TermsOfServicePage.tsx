import React from 'react';
import { PageLayout } from '../layouts/PageLayout';

export const TermsOfServicePage: React.FC = () => {
    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-4xl mx-auto">
                    <h1 className="heading-xl mb-8 text-center">Terms of Service</h1>

                    <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
                        <p className="text-lg text-gray-600 leading-relaxed">
                            Welcome to EmpowerEd Learnings. By creating an account, booking sessions, subscribing, or using the platform, you agree to these Terms of Service. EmpowerEd is a technology marketplace that connects students/parents with independent mentors and provides mentors with tools (visibility, profile, scheduling, and payment facilitation). EmpowerEd does not provide tutoring/educational services and is not an employer, agent, or partner of any mentor.
                        </p>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">SECTION A — Students &amp; Parents/Guardians</h2>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">1) Eligibility &amp; Parent Responsibility</h3>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>Students under 18 must use the platform through a parent/legal guardian.</li>
                                <li>Parents/guardians are responsible for bookings, payments, and supervising minors as appropriate.</li>
                                <li>If a student is under 13, a parent/guardian must create/manage the account and provide any required consent.</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2) Booking &amp; Payments (Not Recurring)</h3>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>Sessions are paid weekly, per upcoming session.</li>
                                <li>A session is confirmed only after payment is completed.</li>
                                <li>After completing a session, the next session must be paid to remain confirmed.</li>
                                <li>If payment is not completed by the required time shown in the dashboard and/or reminders, the session may be unconfirmed and the time slot released.</li>
                                <li>Payments are processed securely through Stripe (or another integrated provider). EmpowerEd does not store full payment card details.</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3) Rescheduling &amp; Missed Sessions</h3>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>Sessions may be rescheduled only if requested at least 24 hours before the scheduled start time.</li>
                                <li>Sessions cannot be rescheduled within 24 hours.</li>
                                <li>Missed sessions are typically considered used and non-refundable unless the mentor chooses otherwise.</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4) Refunds (Students/Parents)</h3>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>EmpowerEd does not guarantee refunds.</li>
                                <li>We strongly encourage students/parents to book a free trial (if offered by the mentor) before making a longer-term commitment.</li>
                                <li>Refunds, credits, or makeup sessions are determined by the mentor’s stated policy.</li>
                                <li>EmpowerEd does not facilitate or mediate refund disputes between mentors and students/parents.</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5) Educational Outcomes</h3>
                            <p>
                                All mentors on EmpowerEd go through admin review and verification before their profile goes live. However, we do not guarantee academic improvement, results, grades, admissions outcomes, or performance outcomes. Mentors are independent and responsible for their services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">SECTION B — Mentors</h2>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">6) Independent Contractor Status</h3>
                            <p>Mentors are independent contractors, not employees or agents of EmpowerEd. Mentors are responsible for:</p>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>Service quality, methods, and content</li>
                                <li>Pricing and policies (including refunds/credits)</li>
                                <li>Taxes, compliance, and any required licenses/insurance</li>
                                <li>Professional conduct and communications</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">7) Subscription Plans &amp; Fees (No-Commission Marketplace)</h3>
                            <p>EmpowerEd is subscription-based for mentors. We do not take commission from mentor earnings. Current annual plans:</p>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>Standard: $25/year</li>
                                <li>Pro: $45/year</li>
                                <li>Premium: $85/year</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">8) Subscription Cancellation (Mentors)</h3>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>You may cancel your subscription before the next billing cycle to stop future charges.</li>
                                <li>Your access may continue through the remainder of your paid term, depending on platform settings.</li>
                                <li>Subscription fees are generally non-refundable unless required by law.</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">9) Profile Accuracy, Verification, and Conduct</h3>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>Mentors must provide accurate, truthful, and complete profile information.</li>
                                <li>All mentors must submit verifiable credentials (degrees, certifications, licenses, relevant work history) and any external reviews before their profile goes live.</li>
                                <li>Our admin team reviews submitted documents as part of our internal verification process. Approved profiles may display a verified badge or trust icon.</li>
                                <li>Verification is a platform trust measure and does not constitute a guarantee of accuracy or ongoing validity of credentials.</li>
                                <li>Providing false, misleading, or fraudulent credentials will result in immediate suspension or permanent termination without refund.</li>
                                <li>Mentors must maintain professional, respectful, and lawful conduct at all times.</li>
                                <li>Harassment, discrimination, inappropriate communication, unsafe behavior (especially involving minors), repeated complaints, or failure to meet scheduling obligations may result in reduced visibility, suspension, or permanent removal from the platform without refund.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">GENERAL TERMS (Applies to Everyone)</h2>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">10) Platform Role &amp; Limitation of Liability</h3>
                            <p>EmpowerEd is a facilitator platform only. To the maximum extent permitted by law:</p>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>We are not responsible for mentor services, session outcomes, or disputes between users.</li>
                                <li>We are not liable for indirect or consequential damages.</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">11) Communications</h3>
                            <p>
                                You agree to receive service-related communications (booking confirmations, reminders, payment notices, account/security messages). Marketing communications (if any) can be unsubscribed.
                            </p>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">12) Termination</h3>
                            <p>We may suspend or terminate accounts for violations, fraud, misuse, or safety concerns (especially involving minors).</p>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">13) Governing Law</h3>
                            <p>These Terms are governed by the laws of the State of Texas.</p>
                        </section>
                    </div>
                </div>
            </section>
        </PageLayout>
    );
};

export default TermsOfServicePage;
