import React from 'react';
import { PageLayout } from '../layouts/PageLayout';

export const PrivacyPolicyPage: React.FC = () => {
    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-4xl mx-auto">
                    <h1 className="heading-xl mb-8 text-center">Privacy Policy</h1>

                    <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
                        <p className="text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>
                            <p>
                                We collect information that you provide directly to us, including your name, email address,
                                and any other information you choose to provide when creating an account or using our services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. How We Use Your Information</h2>
                            <p>
                                We use the information we collect to provide, maintain, and improve our services, to process
                                your transactions, to send you technical notices and support messages, and to communicate with
                                you about products, services, and events.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Information Sharing</h2>
                            <p>
                                We do not share your personal information with third parties except as described in this policy.
                                We may share information with service providers who perform services on our behalf.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Data Security</h2>
                            <p>
                                We take reasonable measures to help protect your personal information from loss, theft, misuse,
                                and unauthorized access, disclosure, alteration, and destruction.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Your Rights</h2>
                            <p>
                                You have the right to access, update, or delete your personal information at any time. You can
                                do this by logging into your account or contacting us directly.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Contact Us</h2>
                            <p>
                                If you have any questions about this Privacy Policy, please contact us at privacy@emplearnings.com
                            </p>
                        </section>
                    </div>
                </div>
            </section>
        </PageLayout>
    );
};

export default PrivacyPolicyPage;
