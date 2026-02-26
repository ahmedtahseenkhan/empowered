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
                            At EmpowerEd Learnings, your privacy is important to us. This Privacy Policy explains how we collect, use, protect, and share your personal information when you use our platform and services.
                        </p>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>
                            <p className="mb-3">We collect information that you provide directly to us, including:</p>
                            <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li><strong>Account Information:</strong> Name, email address, phone number, and profile details when you create an account.</li>
                                <li><strong>Payment Information:</strong> Billing details processed securely through Stripe. EmpowerEd Learnings does not store your payment card information.</li>
                                <li><strong>Session Data:</strong> Information related to your bookings, session history, mentor interactions, and learning progress.</li>
                                <li><strong>Communications:</strong> Messages exchanged between students and mentors through the platform's messaging feature.</li>
                                <li><strong>Usage Data:</strong> Information about how you interact with the platform, including pages visited, features used, and time spent on the platform.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. How We Use Your Information</h2>
                            <p className="mb-3">We use the information we collect to:</p>
                            <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li>Provide, maintain, and improve our platform and services.</li>
                                <li>Match students with suitable mentors based on their profiles and preferences.</li>
                                <li>Process payments and manage billing through Stripe.</li>
                                <li>Send session reminders, notifications, and important platform updates.</li>
                                <li>Personalize your learning experience and dashboard features.</li>
                                <li>Respond to your inquiries and provide customer support.</li>
                                <li>Ensure platform security and prevent fraudulent activity.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Information Sharing</h2>
                            <p className="mb-3">We do not sell or share your personal information with third parties, except in the following circumstances:</p>
                            <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li><strong>With Mentors:</strong> Limited information (such as your name and session details) is shared with your selected mentor to facilitate learning sessions.</li>
                                <li><strong>Service Providers:</strong> We may share information with trusted third-party service providers (such as Stripe for payment processing) who assist in operating the platform.</li>
                                <li><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or governmental authority.</li>
                                <li><strong>With Your Consent:</strong> We may share information with your explicit permission, such as testimonials or promotional content.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Data Security</h2>
                            <p>
                                We take reasonable measures to help protect your personal information from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction. All transactions and personal information are encrypted and stored securely. Payments are processed through Stripe's secure payment infrastructure.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Your Rights</h2>
                            <p className="mb-3">You have the following rights regarding your personal information:</p>
                            <ul className="list-disc list-inside space-y-2 text-gray-700">
                                <li><strong>Access:</strong> You can access and view your personal information through your dashboard at any time.</li>
                                <li><strong>Update:</strong> You can update or correct your personal information through your account settings.</li>
                                <li><strong>Delete:</strong> You may request deletion of your account and personal data by contacting our support team.</li>
                                <li><strong>Opt-Out:</strong> You can opt out of promotional communications at any time.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Cookies and Tracking</h2>
                            <p>
                                We may use cookies and similar technologies to enhance your experience on the platform. Cookies help us understand how you use our services and allow us to remember your preferences. You can manage your cookie settings through your browser.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Children's Privacy</h2>
                            <p>
                                EmpowerEd Learnings is designed for use by students of various ages. For students under 18, a parent or guardian must create and manage the account. We do not knowingly collect personal information from children under 13 without parental consent.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Changes to This Policy</h2>
                            <p>
                                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on our platform. Your continued use of EmpowerEd Learnings after changes are posted constitutes your acceptance of the revised policy.
                            </p>
                        </section>

                        <section className="bg-primary-50 rounded-2xl p-6 mt-8">
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
                            <p className="text-gray-700">
                                If you have any questions about this Privacy Policy or how we handle your personal information, please contact us at{' '}
                                <a href="mailto:support@emplearnings.com" className="text-primary-700 hover:text-primary-900 font-medium underline">
                                    support@emplearnings.com
                                </a>
                            </p>
                        </section>
                    </div>
                </div>
            </section>
        </PageLayout>
    );
};

export default PrivacyPolicyPage;
