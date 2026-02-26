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
        answer: 'We connect students with expert mentors in three categories: Academic Success, Skill Development, and Personal Growth. Choose your mentor, select a schedule that works for you, and enjoy personalized learning with flexible options.',
    },
    {
        question: 'What types of mentors are available on EmpowerEd Learnings?',
        answer: 'We offer a diverse range of mentors specializing in Academic Success, Skill Development, and Personal Growth. Whether you need help with core subjects, personal growth, or mastering a new skill, we have the right expert for you.',
    },
    {
        question: 'How do I get charged?',
        answer: 'All mentors on the platform offer three tiers of sessions: once a week, twice a week, or three times a week. You can select the option that best fits your learning needs. Payments are billed weekly on a recurring basis through our secure Stripe system.',
    },
    {
        question: 'What payment methods are accepted?',
        answer: 'We accept all major credit and debit cards through our secure payment gateway, including Visa, MasterCard, and American Express.',
    },
    {
        question: 'Are my payments secure?',
        answer: 'Yes. All payments are securely processed through Stripe, and you can track them at any time in your dashboard.',
    },
    {
        question: 'Can I cancel my payments at any time?',
        answer: 'Yes. Cancel anytime through your dashboard. To avoid the next week\'s charge, cancel at least 24 hours before your next billing date.',
    },
    {
        question: 'Can I try a free session before committing?',
        answer: 'Some mentors offer a free trial session so you can experience their teaching style before committing. Check the mentor\'s profile for availability.',
    },
    {
        question: 'Why should I sign up for at least 4 Sessions?',
        answer: 'Consistency is key to progress. Research shows that a minimum of 4 sessions helps build momentum and deliver better results. Our flexible weekly options make it easy to stay committed.',
    },
    {
        question: 'What features does my personal dashboard include?',
        answer: (
            <div>
                <p className="mb-3">Once you sign up, your dashboard provides tools to enhance your learning experience, including:</p>
                <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                    <li>Scheduling and rescheduling sessions</li>
                    <li>Receiving reminders and notifications</li>
                    <li>Tracking your progress</li>
                    <li>Accessing teacher notes</li>
                    <li>Viewing purchased courses</li>
                    <li>Upcoming & past payments</li>
                    <li>Option to cancel payments</li>
                </ul>
            </div>
        ),
    },
    {
        question: 'What if I need to reschedule a session?',
        answer: 'Sessions may only be rescheduled if 24 or more hours remain before the scheduled start time. You can reschedule your classes through your dashboard. Simply check the mentor\'s availability and choose a new time that works for both of you.',
    },
    {
        question: 'How do I communicate with my mentor outside of class time?',
        answer: 'Your dashboard allows you to send messages to your mentor. This feature makes it easy to ask questions or get additional support as needed.',
    },
    {
        question: 'Is my information secure on the platform?',
        answer: 'Yes, we take privacy and data security seriously. All transactions and personal information are encrypted and stored securely.',
    },
    {
        question: 'Can students leave reviews for their mentors?',
        answer: 'Yes! Students can leave feedback and ratings for their mentors, which helps others make informed choices when selecting a mentor.',
    },
    {
        question: 'Are there any refunds available?',
        answer: 'EmpowerEd Learnings does not offer refunds. Please ensure you cancel your payment before the next billing cycle to avoid further charges.',
    },
    {
        question: 'Who should I contact for help and support?',
        answer: 'For any technical support or issues using the EmpowerEd Learnings platform, our team is here to assist you. However, if you have questions about scheduling, rescheduling, or payments, please reach out directly to your mentor. EmpowerEd Learnings does not take commissions or manage mentor earnings — we\'re dedicated to empowering both students and mentors by providing a seamless platform to connect.',
    },
];

const mentorFaqs: FAQItem[] = [
    {
        question: 'What happens after the 1-month free trial?',
        answer: 'After your free trial ends, the plan you selected will automatically charge you based on your subscription (monthly, bi-annually, or annually). If you wish to cancel, please do so before the trial ends to avoid charges. You can change your plan at any time from your dashboard.',
    },
    {
        question: 'How can I keep track of my payments?',
        answer: 'We use a secure Stripe payment system. You can track all your payments directly on your personal dashboard, where you\'ll see real-time updates on payments received, upcoming transactions, all clearly laid out for your convenience.',
    },
    {
        question: 'What is the demo call?',
        answer: 'Our admin team will walk you through the platform, explain the different subscription plans, and help you choose the best plan for your business needs during the demo call. It\'s a great way to get an inside look at how everything works.',
    },
    {
        question: 'What\'s included with onboarding and tech support?',
        answer: 'Once you subscribe, a dedicated team member will guide you through setting up your profile, showcasing your offers, and advising on effective marketing strategies. We also provide ongoing support for any technical issues related to the website, platform, or payment system.',
    },
    {
        question: 'How do you handle marketing for me?',
        answer: 'Once your marketing efforts are active, our dedicated marketing team takes care of everything. For Pro and Premium plans, we use a mix of strategies like online ads, community events, and more. You can also add video features to ad campaigns for extra visibility. We provide campaign performance reports upon request, detailing reach, engagement, and leads.',
    },
    {
        question: 'How does mentor verification work?',
        answer: 'We review your credentials, certifications, and external reviews before approving your profile. Once verified, you\'ll receive the Verified Mentor Badge — displayed prominently on your profile to help build trust with students.',
    },
    {
        question: 'Can I sell pre-recorded courses?',
        answer: 'Yes — with the Premium Plan, you can upload and sell pre-recorded courses directly through your profile, giving you an additional income stream.',
    },
    {
        question: 'What if I want to cancel my subscription? What\'s the refund policy?',
        answer: 'We do not offer refunds. If you are unsatisfied with the service, please cancel before the next billing cycle to avoid charges. You can cancel your plan directly through your dashboard at any time.',
    },
    {
        question: 'Can I upgrade or downgrade my plan later?',
        answer: 'Yes, you can change your subscription at any time. Any upgrades take effect immediately, while downgrades will apply at the start of your next billing cycle.',
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
