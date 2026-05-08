import React from 'react';
import { Sparkles, Bot, BookOpen, BarChart3, Users, Star, Megaphone, ArrowRight } from 'lucide-react';

const features = [
    { icon: Bot, label: 'AI-Assisted Lesson Planning', desc: 'Generate lesson templates and outlines instantly.' },
    { icon: Users, label: 'Multiple Listings', desc: 'Up to 3 major categories and subcategories.' },
    { icon: Star, label: 'Priority Marketplace Placement', desc: 'Featured badge and top search visibility.' },
    { icon: BookOpen, label: 'Sell Pre-Recorded Courses', desc: 'Create and sell courses to students worldwide.' },
    { icon: BarChart3, label: 'Profile Performance Insights', desc: 'Track views, clicks, and student interest.' },
    { icon: Megaphone, label: 'Weekly Social Media Spotlight', desc: 'We promote your profile on our social channels.' },
];

interface Props {
    onGoToDashboard: () => void;
    onSetupPayments: () => void;
}

const BetaConfirmationModal: React.FC<Props> = ({ onGoToDashboard, onSetupPayments }) => (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
        style={{ background: 'rgba(15,10,30,0.75)', backdropFilter: 'blur(6px)' }}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-auto" style={{ marginTop: 'max(1rem, 5vh)', marginBottom: 'max(1rem, 5vh)' }}>

            {/* Header */}
            <div className="bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-600 px-8 py-8 text-center relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
                <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5" />
                <div className="relative">
                    <div className="text-5xl mb-4">🎉</div>
                    <h2 className="text-3xl font-extrabold text-white mb-2">Congratulations!</h2>
                    <p className="text-purple-200 text-base max-w-md mx-auto leading-relaxed">
                        Your free 2-month beta <span className="text-white font-bold">Premium</span> plan has started.
                        No credit card is required. You can start using EmpowerEd Learnings today.
                        Please <a href="mailto:support@emplearnings.com" className="underline text-white">contact us</a> if you have any questions.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 bg-white/20 text-white text-sm font-semibold px-4 py-1.5 rounded-full border border-white/30">
                        <Sparkles className="w-4 h-4" /> Premium Plan — Active
                    </div>
                </div>
            </div>

            {/* Features grid */}
            <div className="px-8 py-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">What's included in your Premium plan</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {features.map(({ icon: Icon, label, desc }) => (
                        <div key={label} className="flex items-start gap-3 bg-purple-50/60 rounded-2xl p-3.5">
                            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                                <Icon className="w-4 h-4 text-purple-700" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900 leading-snug">{label}</p>
                                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 text-center mt-4">
                    Questions? <a href="mailto:support@emplearnings.com" className="text-purple-600 font-medium underline">Contact us</a> — we're here to help.
                </p>
            </div>

            {/* CTAs */}
            <div className="px-8 pb-6 flex flex-col sm:flex-row gap-3">
                <button onClick={onGoToDashboard}
                    className="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-bold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 text-sm">
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={onSetupPayments}
                    className="flex-1 border-2 border-gray-200 hover:border-purple-300 text-gray-700 font-semibold py-3.5 rounded-2xl transition-colors text-sm">
                    Setup Stripe Payments
                </button>
            </div>
        </div>
    </div>
);

export default BetaConfirmationModal;
