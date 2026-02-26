import React from 'react';
import { PageLayout } from '../layouts/PageLayout';

export const TermsOfServicePage: React.FC = () => {
    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-4xl mx-auto">
                    <h1 className="heading-xl mb-8 text-center">Terms and Conditions</h1>

                    <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
                        <p className="text-lg text-gray-600 leading-relaxed">
                            Welcome to EmpowerEd Learnings! These Terms and Conditions outline the terms of use for students and parents engaging with our platform and services. Our mission is to provide flexible, personalized learning experiences, empowering both students and mentors to succeed.
                        </p>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Scope of Services</h2>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>EmpowerEd Learnings provides a platform that connects students with verified mentors specializing in Academic Success, Skill Development, and Personal Growth.</li>
                                <li>Students can select mentors, schedule sessions, and track progress through their personal dashboard.</li>
                                <li>All mentors are independent professionals, responsible for their own scheduling, availability, teaching methods, and payment arrangements with students.</li>
                                <li>All mentors undergo a credential verification and rigorous screening process before their profiles are approved and published.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Payments</h2>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li><strong>Learning Plans:</strong> Choose from three flexible options — once a week, twice a week — billed weekly.</li>
                                <li><strong>Recurring Payments:</strong> Your chosen plan will automatically renew each week unless canceled.</li>
                                <li><strong>Rescheduling Policy:</strong> Students may reschedule up to 24 hours before the session. After 24 hours, the session is considered used.</li>
                                <li><strong>Cancellation Policy:</strong> You may cancel at any time, but to avoid charges for the next billing cycle.</li>
                                <li><strong>Unforeseen Circumstances:</strong> In rare unforeseen circumstances where a scheduled session cannot take place due to technical issues or emergencies, the mentor may issue a makeup session credit at their discretion. Credits can be applied toward a future session.</li>
                                <li><strong>Secure Processing:</strong> Payments are securely processed via Stripe. EmpowerEd Learnings does not store your payment information.</li>
                                <li>EmpowerEd Learnings does not take any commission from mentor earnings.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Free Trial and Class Cancellations</h2>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li><strong>Trial Classes:</strong> Some mentors offer a free trial session. Look for this option in the mentor's profile before booking.</li>
                                <li><strong>Rescheduling:</strong> Sessions may only be rescheduled if requested at least 24 hours before the scheduled start time.</li>
                                <li><strong>Cancellations:</strong> Missed sessions without prior notice may not be refunded or rescheduled, at the mentor's discretion.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Confidentiality and Privacy</h2>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>Your privacy is important to us. We do not sell or share personal information with third parties.</li>
                                <li>Information you provide is securely stored and used only to improve your learning experience.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Code of Conduct</h2>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li><strong>Respectful Engagement:</strong> Students, parents, and mentors are expected to communicate respectfully and maintain a positive learning environment.</li>
                                <li><strong>Preparedness:</strong> Arrive on time and ready to engage in your sessions.</li>
                                <li><strong>Platform Use:</strong> Use your personal dashboard to manage your schedule, view materials, track progress, and communicate with your mentor.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Refund Policy</h2>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>EmpowerEd Learnings does not process refunds.</li>
                                <li>Any refund for unused sessions is at the mentor's sole discretion and must be arranged directly with them.</li>
                                <li>EmpowerEd Learnings is not responsible for disputes regarding refunds.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Marketing and Promotional Use</h2>
                            <p>
                                With your permission, EmpowerEd Learnings may use testimonials, photos, or video content shared by students, parents, or mentors for marketing purposes.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Limitation of Liability</h2>
                            <ul className="list-disc list-inside space-y-3 text-gray-700">
                                <li>EmpowerEd Learnings serves as a facilitator, connecting students with independent mentors.</li>
                                <li>We are not responsible for the content, outcomes, or results of sessions, nor for any damages or losses arising from mentor-student interactions.</li>
                                <li>By using the platform, you acknowledge that mentors are independent contractors and that EmpowerEd Learnings does not control their teaching methods.</li>
                            </ul>
                        </section>

                        <section className="bg-primary-50 rounded-2xl p-6 mt-8">
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Acknowledgment</h2>
                            <p className="text-gray-700">
                                By accessing or using EmpowerEd Learnings, you agree to these Terms & Conditions. Our mission is to provide a safe, supportive, and empowering space for students to achieve their full potential.
                            </p>
                            <p className="text-gray-700 mt-3 font-medium">
                                We look forward to supporting your learning journey!
                            </p>
                        </section>
                    </div>
                </div>
            </section>
        </PageLayout>
    );
};

export default TermsOfServicePage;
