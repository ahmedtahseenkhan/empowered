import React, { useState } from 'react';
import { PageLayout } from '../layouts/PageLayout';
import { ChevronDown, GraduationCap, Users } from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string | React.ReactNode;
}

const studentFaqs: FAQItem[] = [
    {
        question: 'How does EmpowerEd Learnings work?',
        answer: 'We connect students with mentors in three categories: Academic Success, Skill Development, and Life Coaching. Choose your mentor, select a time, and pay to confirm your session.',
    },
    {
        question: 'How do payments work?',
        answer: 'Sessions are paid weekly, per upcoming session. A session is confirmed only after payment is completed. After finishing a session, you must pay to confirm the next session. There is no automatic recurring billing.',
    },
    {
        question: 'Is there a platform fee?',
        answer: 'Yes. A 10% platform fee is added to each payment. This supports the dashboard tools and technology provided by EmpowerEd Learnings.',
    },
    {
        question: 'What happens if I don’t pay for the next session?',
        answer: 'If payment is not completed by the required time shown in your dashboard or reminders, the session may be unconfirmed and the time slot released.',
    },
    {
        question: 'What payment methods are accepted?',
        answer: 'We accept major credit and debit cards through Stripe, including Visa, MasterCard, and American Express.',
    },
    {
        question: 'Are payments secure?',
        answer: 'Yes. Payments are securely processed through Stripe. EmpowerEd does not store full payment card details.',
    },
    {
        question: 'Can I try a free session before committing?',
        answer: 'Some mentors offer a free trial session. We strongly encourage booking a free trial, if available, before making a longer-term commitment. Please check the mentor’s profile.',
    },
    {
        question: 'Do I need to commit to multiple sessions?',
        answer: 'There is no required commitment. However, consistency helps students make meaningful progress, and many families choose to book multiple sessions for better results.',
    },
    {
        question: 'What if I want to stop sessions?',
        answer: 'You can stop booking at any time. Since payments are per session, there is no subscription to cancel.',
    },
    {
        question: 'Can I reschedule a session?',
        answer: 'Yes. Sessions may be rescheduled if requested at least 24 hours before the scheduled start time. Sessions cannot be rescheduled within 24 hours.',
    },
    {
        question: 'What happens if I miss a session?',
        answer: 'Missed sessions are typically considered used and non-refundable unless the mentor chooses to offer a makeup session.',
    },
    {
        question: 'Are mentors verified?',
        answer: 'All mentors go through an admin review and verification process before their profile goes live. However, results and outcomes are not guaranteed.',
    },
    {
        question: 'Can my child use the platform?',
        answer: 'Yes, but students under 18 must use the platform through a parent or legal guardian account.',
    },
    {
        question: 'Are there any refunds available?',
        answer: 'EmpowerEd does not guarantee refunds and does not facilitate refund disputes between mentors and students. Refunds or credits are determined by the mentor’s stated policy.',
    },
    {
        question: 'What does my dashboard allow me to do?',
        answer: 'Your dashboard allows you to schedule or reschedule sessions, receive reminders, message your mentor, and track upcoming sessions and payment history.',
    },
    {
        question: 'Can students leave reviews?',
        answer: 'Yes. Students can leave feedback and ratings to help other families make informed decisions.',
    },
    {
        question: 'Who should I contact for support?',
        answer: 'For technical platform issues, contact EmpowerEd support. For scheduling, session, or refund-related matters, please contact your mentor directly.',
    },
];

const mentorFaqs: FAQItem[] = [
    {
        question: 'How does EmpowerEd make money?',
        answer: 'EmpowerEd is a subscription-based SaaS marketplace. Mentors pay an annual subscription for visibility and business tools. We do not take commission from your session earnings.',
    },
    {
        question: 'What are the current subscription plans?',
        answer: 'We offer three annual plans: Standard ($25/year), Pro ($45/year), and Premium ($85/year). Each plan provides increasing levels of visibility and promotional features.',
    },
    {
        question: 'Is there a free trial?',
        answer: 'Yes. A one-month free trial may be offered. If you do not cancel before the trial ends, your selected annual plan will be charged automatically.',
    },
    {
        question: 'What happens after the free trial ends?',
        answer: 'Your selected annual plan will be billed. To avoid charges, cancel before the trial period ends. You can manage or change your plan through your dashboard.',
    },
    {
        question: 'Can I cancel my subscription?',
        answer: 'Yes. You can cancel before your next billing cycle to stop future charges. Subscription fees are non-refundable.',
    },
    {
        question: 'Can I upgrade or downgrade my plan?',
        answer: 'Yes. Upgrades take effect immediately. Downgrades apply at the start of the next billing cycle.',
    },
    {
        question: 'Do you take commission from my sessions?',
        answer: 'No. EmpowerEd does not take commission from your earnings. Payment processing fees may still apply through Stripe.',
    },
    {
        question: 'How do students pay for sessions?',
        answer: 'Students pay weekly, per upcoming session. A session is confirmed only after payment is completed. There is no automatic recurring billing for students.',
    },
    {
        question: 'How will I get paid by students?',
        answer: 'Students pay weekly per upcoming session through the platform. Payments are processed via Stripe and transferred to your connected payout account, subject to Stripe’s processing timelines and fees.',
    },
    {
        question: 'How does mentor verification work?',
        answer: 'You must submit verifiable credentials before your profile goes live. Our admin team reviews submitted documents and approved profiles may receive a verified badge.',
    },
    {
        question: 'Am I an employee of EmpowerEd?',
        answer: 'No. Mentors are independent contractors responsible for their services, pricing, taxes, and compliance.',
    },
];

const AccordionItem: React.FC<{
    item: FAQItem;
    isOpen: boolean;
    onToggle: () => void;
    index: number;
}> = ({ item, isOpen, onToggle, index }) => {
    return (
        <div
            className={`group border border-gray-200 rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'shadow-lg border-primary-200 bg-white' : 'bg-white hover:shadow-md hover:border-gray-300'
                }`}
            style={{ animationDelay: `${index * 60}ms` }}
        >
            <button
                id={`faq-toggle-${index}`}
                onClick={onToggle}
                className="w-full flex items-center justify-between p-5 md:p-6 text-left transition-colors duration-200"
            >
                <span
                    className={`text-[15px] md:text-[17px] font-semibold pr-4 transition-colors duration-200 ${isOpen ? 'text-primary-900' : 'text-gray-800 group-hover:text-primary-800'
                        }`}
                >
                    {item.question}
                </span>
                <div
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen
                            ? 'bg-gradient-to-br from-primary-800 to-primary-600 rotate-180'
                            : 'bg-gray-100 group-hover:bg-primary-50'
                        }`}
                >
                    <ChevronDown
                        className={`w-5 h-5 transition-colors duration-200 ${isOpen ? 'text-white' : 'text-gray-500 group-hover:text-primary-700'
                            }`}
                    />
                </div>
            </button>
            <div
                className={`overflow-hidden transition-all duration-400 ease-in-out ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="px-5 md:px-6 pb-5 md:pb-6 text-[14px] md:text-[15px] text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                    {item.answer}
                </div>
            </div>
        </div>
    );
};

type TabType = 'students' | 'mentors';

export const FAQPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('students');
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const currentFaqs = activeTab === 'students' ? studentFaqs : mentorFaqs;

    const handleToggle = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setOpenIndex(0);
    };

    return (
        <PageLayout>
            {/* Hero Section */}
            <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-secondary-700 py-16 md:py-24">
                {/* Decorative circles */}
                <div className="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
                <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-accent-500/10 rounded-full -translate-x-1/2 -translate-y-1/2" />

                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
                        <span className="text-white/90 text-sm font-medium">Got Questions? We've Got Answers</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
                        Frequently Asked{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-300 to-accent-500">
                            Questions
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
                        Find answers to common questions about our platform, pricing, and features for both students and mentors.
                    </p>
                </div>
            </section>

            {/* Tabs & Content */}
            <section className="section-container">
                <div className="max-w-4xl mx-auto">
                    {/* Tab Switcher */}
                    <div className="flex justify-center mb-12">
                        <div className="inline-flex bg-gray-100 rounded-2xl p-1.5 shadow-inner">
                            <button
                                id="tab-students"
                                onClick={() => handleTabChange('students')}
                                className={`flex items-center gap-2.5 px-6 py-3 md:px-8 md:py-3.5 rounded-xl text-[14px] md:text-[15px] font-semibold transition-all duration-300 ${activeTab === 'students'
                                        ? 'bg-gradient-to-r from-primary-900 to-primary-700 text-white shadow-lg shadow-primary-900/25 scale-[1.02]'
                                        : 'text-gray-600 hover:text-gray-800 hover:bg-white/60'
                                    }`}
                            >
                                <GraduationCap className="w-5 h-5" />
                                Students & Parents
                            </button>
                            <button
                                id="tab-mentors"
                                onClick={() => handleTabChange('mentors')}
                                className={`flex items-center gap-2.5 px-6 py-3 md:px-8 md:py-3.5 rounded-xl text-[14px] md:text-[15px] font-semibold transition-all duration-300 ${activeTab === 'mentors'
                                        ? 'bg-gradient-to-r from-primary-900 to-primary-700 text-white shadow-lg shadow-primary-900/25 scale-[1.02]'
                                        : 'text-gray-600 hover:text-gray-800 hover:bg-white/60'
                                    }`}
                            >
                                <Users className="w-5 h-5" />
                                Mentors
                            </button>
                        </div>
                    </div>

                    {/* Section Title */}
                    <div className="text-center mb-10">
                        <h2 className="heading-md text-gray-900">
                            {activeTab === 'students' ? 'For Students & Parents' : 'For Mentors'}
                        </h2>
                        <p className="text-gray-500 mt-2 text-[15px]">
                            {activeTab === 'students'
                                ? 'Everything you need to know about learning with EmpowerEd Learnings.'
                                : 'Answers to help you get started and grow your mentoring business.'}
                        </p>
                    </div>

                    {/* FAQ Accordion */}
                    <div className="space-y-4">
                        {currentFaqs.map((item, index) => (
                            <AccordionItem
                                key={`${activeTab}-${index}`}
                                item={item}
                                isOpen={openIndex === index}
                                onToggle={() => handleToggle(index)}
                                index={index}
                            />
                        ))}
                    </div>

                    {/* CTA Section */}
                    <div className="mt-16 text-center">
                        <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-3xl p-8 md:p-12 border border-primary-100">
                            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                                Still have questions?
                            </h3>
                            <p className="text-gray-600 mb-6 max-w-lg mx-auto">
                                Can't find what you're looking for? Reach out to our support team and we'll get back to you as soon as possible.
                            </p>
                            <a
                                href="/contact-us"
                                className="inline-flex items-center gap-2 btn-gradient px-8 py-3 text-[15px]"
                            >
                                Contact Us
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </PageLayout>
    );
};

export default FAQPage;
