import React from 'react';
import { PageLayout } from '../layouts/PageLayout';

export const PrivacyPolicyPage: React.FC = () => {
    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-4xl mx-auto">
                    <h1 className="heading-xl mb-8 text-center">Privacy Policy</h1>

                    <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
                        <p className="text-lg text-gray-600 leading-relaxed">
                            EmpowerEd Learnings respects your privacy. This Privacy Policy explains how we collect, use, and protect information from users of our platform, including students, parents/guardians, and mentors. We collect only the information necessary to operate our marketplace, facilitate bookings and subscriptions, and maintain platform safety.
                        </p>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">SECTION A — Students &amp; Parents/Guardians</h2>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Information We Collect</h3>
                            <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li>Name, email address, and contact details</li>
                                <li>Booking details (mentor selected, session times, preferences)</li>
                                <li>Messages sent through the platform</li>
                                <li>Usage data (page views, session activity, device/browser data)</li>
                            </ul>
                            <p>
                                Payment information is processed securely by Stripe. We do not store full payment card details.
                            </p>
                        </section>

                        <section>
                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">How We Use This Information</h3>
                            <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li>To create and manage accounts</li>
                                <li>To confirm bookings and send reminders</li>
                                <li>To facilitate communication between matched users</li>
                                <li>To improve platform performance and security</li>
                                <li>To prevent fraud, abuse, or misuse</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Children’s Privacy</h3>
                            <p>
                                Students under 18 must use the platform through a parent or legal guardian. For children under 13, parent/guardian consent is required where applicable.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">SECTION B — Mentors</h2>

                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Information We Collect</h3>
                            <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li>Profile information (bio, qualifications, certifications, availability)</li>
                                <li>Verification documents submitted for review</li>
                                <li>Public-facing content you choose to display</li>
                                <li>Usage data and platform activity</li>
                            </ul>
                            <p>
                                Payment account connections are handled through Stripe or integrated payment providers.
                            </p>
                        </section>

                        <section>
                            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">How We Use This Information</h3>
                            <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li>To review and approve mentor profiles</li>
                                <li>To display public profiles to students</li>
                                <li>To provide scheduling and business tools</li>
                                <li>To maintain marketplace quality and safety</li>
                                <li>To communicate about subscription billing and updates</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Sharing of Information</h2>
                            <p>We may share information:</p>
                            <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li>Between matched users (mentor and student/parent) to facilitate sessions</li>
                                <li>With payment processors (e.g., Stripe) to process transactions</li>
                                <li>With service providers (hosting, analytics, communication tools) strictly to operate the platform</li>
                                <li>When required by law or to protect platform safety</li>
                            </ul>
                            <p>
                                We do not sell personal information in the ordinary course of business.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Marketing Use</h2>
                            <p>
                                If you voluntarily provide testimonials, videos, or promotional materials and give explicit permission, we may use that content for marketing. Participation is optional and can be withdrawn for future use.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Security</h2>
                            <p>
                                We use reasonable technical and administrative safeguards to protect your information. However, no system can guarantee absolute security.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Data Retention</h2>
                            <p>
                                We retain information while accounts remain active and as required for legal, accounting, or compliance purposes. You may request account deletion subject to legal obligations.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Updates</h2>
                            <p>
                                We may update this Privacy Policy periodically. Continued use of the platform indicates acceptance of the updated version.
                            </p>
                        </section>
                    </div>
                </div>
            </section>
        </PageLayout>
    );
};

export default PrivacyPolicyPage;
