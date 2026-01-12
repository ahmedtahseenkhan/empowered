import React from 'react';
import { motion } from 'framer-motion';
import { Image, Box } from 'lucide-react'; // Placeholder imports if needed, but we use icons
import { FaRocket, FaStar, FaCrown, FaCheck, FaTimes, FaShieldAlt, FaUsers } from 'react-icons/fa';
import { Clock, Star } from '../../assets';

// Helper to replace next/image
const Img = ({ src, alt, className, ...props }: any) => (
    <img src={src} alt={alt} className={className} {...props} />
);

const ChoosePlanDesktop = ({
    onChoosePlan,
}: {
    onChoosePlan: (planId: string) => void;
}) => {
    const plans = [
        {
            planId: "1",
            name: "Standard",
            tagline: "For those seeking a strong online presence",
            price: 85,
            billingCycle: "monthly",
            description: "charged monthly",
            color: "from-blue-500 to-blue-600",
            icon: <FaRocket className="w-8 h-8" />,
            features: [
                "Custom Profile Page to showcase your expertise and services",
                "Personal Dashboard with Built-in CRM",
                "Social Media Marketing for consistent student flow",
                "Personal Calendar for easy scheduling/rescheduling",
                "Automated email reminders and notifications for students",
                "Student Portal for personalized learning",
                "Smooth Stripe integration for recurring payments",
                "SEO optimization",
                "Onboarding & Tech Support",
                "1-Month Free Trial",
            ],
        },
        {
            planId: "2",
            name: "Pro",
            tagline: "For the growing business ready to scale",
            price: 65,
            billingCycle: "month",
            description: "charged bi-annually",
            color: "from-purple-600 to-purple-700",
            icon: <FaStar className="w-8 h-8" />,
            features: [
                "Everything from the Standard Plan, plus:",
                "Upgraded custom profile to highlight your services, offers, and reviews for maximum visibility",
                "Advanced marketing strategies to drive more leads, including video promotions to spotlight your expertise",
                "1-Month Free Trial",
            ],
        },
        {
            planId: "3",
            name: "Premium",
            tagline:
                "For those looking to diversify their reach and maximize revenue",
            price: 50,
            billingCycle: "month",
            description: "billed annually",
            color: "from-yellow-500 to-yellow-600", // Gold color approximation
            icon: <FaCrown className="w-8 h-8" />,
            popular: true,
            features: [
                "All Pro Plan features, plus:",
                "Option to list in more than one major category and add multiple subcategories to broaden reach and increase revenue.",
                "Sell Pre-Recorded Courses: Create additional revenue streams.",
                "1-Month Free Trial",
            ],
        },
    ];

    return (
        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-100 py-20">
            {/* Header Section */}
            <div className="text-center mb-16">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 font-poppins">
                        Find the <span className="text-[#8B55CC]">Perfect Plan</span> for
                        You!
                    </h1>
                </motion.div>
            </div>

            {/* Pricing Cards */}
            <div className="max-w-7xl mx-auto px-4">
                <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={plan.planId}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: index * 0.2 }}
                            className={`relative rounded-3xl shadow-2xl py-10 overflow-hidden transform hover:scale-105 transition-all duration-300 bg-white ${plan.popular ? "ring-4 ring-purple-500 ring-opacity-50" : ""
                                }`}
                        >
                            {/* Popular Badge */}
                            {plan.popular && (
                                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
                                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
                                        ⭐ MOST POPULAR
                                    </div>
                                </div>
                            )}

                            <div className="p-8 flex flex-col h-full">
                                {/* Plan Header */}
                                <div className="text-center mb-6">
                                    <div
                                        className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r ${plan.color} text-white mb-4 shadow-lg`}
                                    >
                                        {plan.icon}
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2 text-gray-900 font-poppins">
                                        {plan.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 h-10">{plan.tagline}</p>
                                </div>

                                {/* Pricing */}
                                <div className="text-center mb-8">
                                    <div className="flex items-baseline justify-center">
                                        <span className="text-5xl font-extrabold text-gray-900">
                                            ${plan.price}
                                        </span>
                                        <span className="text-sm ml-1 text-gray-600 font-medium">
                                            /{plan.billingCycle}
                                        </span>
                                    </div>
                                    <p className="text-sm mt-2 text-gray-500 font-medium bg-gray-100 inline-block px-3 py-1 rounded-full">
                                        {plan.description}
                                    </p>
                                </div>

                                {/* Features */}
                                <div className="space-y-4 mb-8 flex-grow">
                                    {plan.features.map((feature, featureIndex) => (
                                        <div key={featureIndex} className="flex items-start gap-3">
                                            <div className="mt-1 p-1 rounded-full bg-green-100 flex-shrink-0">
                                                <FaCheck className="w-3 h-3 text-green-600" />
                                            </div>
                                            <p className="text-sm text-gray-700 leading-snug">{feature}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA Button */}
                                <button
                                    onClick={() => onChoosePlan(plan.planId)}
                                    className={`w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-[1.02] shadow-md ${plan.popular
                                            ? "bg-gradient-to-r from-[#D500F9] to-[#FF4081] text-white hover:shadow-xl"
                                            : "bg-gradient-to-r from-[#448AFF] to-[#3D5AFE] text-white hover:shadow-xl"
                                        }`}
                                >
                                    Choose this Plan
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Special Offer Notice */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-center mt-16"
                >
                    <div className="max-w-4xl mx-auto mt-12 bg-gradient-to-r from-orange-400 to-yellow-400 p-1 rounded-3xl shadow-xl">
                        <div className="bg-white/10 backdrop-blur-md rounded-[20px] p-8 text-black">
                            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-4">
                                <h1 className="text-3xl font-bold font-poppins">Special Offer</h1>
                            </div>

                            <div className="flex items-center justify-center gap-4 mb-4">
                                <img src={Star} alt="Star" className="w-8 h-8" />
                                <h3 className="text-xl md:text-2xl font-semibold font-poppins">Don't Miss Out on Our Early Bird Deal!</h3>
                                <img src={Clock} alt="Clock" className="w-8 h-8" />
                            </div>

                            <p className="text-[#4A148C] font-semibold text-lg md:text-xl">
                                Enjoy 2 Month FREE – Absolutely Risk-Free, with No Registration Fees and No Subscription Costs. Limited Time Offer!
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Trust Indicators */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                    className="mt-20 grid md:grid-cols-3 gap-8 text-center"
                >
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                            <FaShieldAlt className="w-8 h-8 text-white" />
                        </div>
                        <h4 className="text-xl font-bold mb-2 text-gray-800">Secure & Trusted</h4>
                        <p className="text-gray-600">
                            Your data is protected with enterprise-grade security
                        </p>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                            <FaUsers className="w-8 h-8 text-white" />
                        </div>
                        <h4 className="text-xl font-bold mb-2 text-gray-800">Verified Mentors</h4>
                        <p className="text-gray-600">
                            Join hundreds of successful educators worldwide
                        </p>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                            <FaStar className="w-8 h-8 text-white" />
                        </div>
                        <h4 className="text-xl font-bold mb-2 text-gray-800">24/7 Support</h4>
                        <p className="text-gray-600">
                            Get help whenever you need it from our expert team
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default ChoosePlanDesktop;
