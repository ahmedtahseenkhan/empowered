import { motion } from 'framer-motion';
import { FaRocket, FaStar, FaCrown, FaCheck, FaTimes, FaShieldAlt, FaUsers } from 'react-icons/fa';
import { Clock, Star } from '../../assets';

const ChoosePlanDesktop = ({
    onChoosePlan,
}: {
    onChoosePlan: (planId: string) => void;
}) => {
    const plans = [
        {
            planId: "STANDARD",
            name: "Standard",
            tagline: "For mentors building their online presence",
            price: 25,
            billingCycle: "month",
            description: "Billed annually",
            color: "from-blue-500 to-blue-600",
            icon: <FaRocket className="w-8 h-8" />,
            features: [
                "Primary public mentor profile",
                "1 searchable listing (listed in 1 major category + 1 subcategory)",
                "Online scheduling & session management",
                "Weekly recurring session setup",
                "Secure student payments (weekly billing)",
                "Automated email reminders",
                "Dedicated meeting link for each session",
                "Student portal access",
                "Mentor dashboard",
                "Platform onboarding & support",
                "1-month free trial",
            ],
            notIncluded: [
                "Marketplace boost",
                "Intro video on profile",
                "Profile highlights & outside reviews",
                "Social media promotion",
                "Dedicated ad placement",
                "AI-assisted lesson planning",
                "Sell pre-recorded courses",
                "Profile performance insights",
            ],
        },
        {
            planId: "PRO",
            name: "Pro",
            tagline: "For mentors ready to grow visibility",
            price: 45,
            billingCycle: "month",
            description: "Billed annually",
            color: "from-purple-600 to-purple-700",
            icon: <FaStar className="w-8 h-8" />,
            popular: true,
            features: [
                "Primary public mentor profile",
                "Up to 3 searchable listings (1 major category + up to 3 subcategories)",
                "Featured mentor badge + marketplace boost",
                "Intro video on public profile",
                "Profile highlights + outside reviews",
                "Monthly social media spotlight",
                "Profile performance insights (views & clicks)",
                "Online scheduling & session management",
                "Weekly recurring session setup",
                "Secure student payments (weekly billing)",
                "Automated email reminders",
                "Dedicated meeting link for each session",
                "Student portal access",
                "Mentor dashboard",
                "Platform onboarding & support",
                "1-month free trial",
            ],
            notIncluded: [
                "Weekly promotion",
                "Dedicated ad placement",
                "AI-assisted lesson planning",
                "Multiple Major Categories",
            ],
        },
        {
            planId: "PREMIUM",
            name: "Premium",
            tagline: "For mentors maximizing reach & revenue",
            price: 85,
            billingCycle: "month",
            description: "Billed annually",
            color: "from-yellow-500 to-yellow-600",
            icon: <FaCrown className="w-8 h-8" />,
            features: [
                "Primary public mentor profile",
                "Multiple searchable listings (up to 3 major categories + 3 subcategories)",
                "Maximum marketplace visibility",
                "Featured mentor badge + priority placement",
                "Intro video on profile",
                "Weekly social media highlight",
                "Weekly dedicated ad placement (platform channel)",
                "AI-assisted lesson planning (templates + outlines)",
                "Sell pre-recorded courses",
                "Profile performance insights",
                "Priority onboarding & support",
                "Online scheduling & session management",
                "Weekly recurring session setup",
                "Secure student payments (weekly billing)",
                "Automated email reminders",
                "Dedicated meeting link for each session",
                "Student portal access",
                "1-month free trial",
            ],
            notIncluded: [],
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
                                <div className="space-y-4 mb-4 flex-grow">
                                    {plan.features.map((feature, featureIndex) => (
                                        <div key={featureIndex} className="flex items-start gap-3">
                                            <div className="mt-1 p-1 rounded-full bg-green-100 flex-shrink-0">
                                                <FaCheck className="w-3 h-3 text-green-600" />
                                            </div>
                                            <p className="text-sm text-gray-700 leading-snug">{feature}</p>
                                        </div>
                                    ))}
                                </div>

                                {(plan.notIncluded?.length ?? 0) > 0 && (
                                    <div className="mb-6 pt-4 border-t border-gray-200 space-y-2">
                                        {plan.notIncluded.map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-3">
                                                <div className="mt-0.5 p-1 rounded-full bg-red-50 flex-shrink-0">
                                                    <FaTimes className="w-3 h-3 text-red-500" />
                                                </div>
                                                <p className="text-sm text-gray-500 leading-snug">{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

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
