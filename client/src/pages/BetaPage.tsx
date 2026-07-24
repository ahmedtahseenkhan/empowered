import React, { useState, useRef } from 'react';
import { PageLayout } from '../layouts/PageLayout';
import api from '../api/axios';

const CATEGORIES = [
    'Academic Tutoring',
    'Test Prep',
    'Skill Development',
    'Life Coaching Or Career Coaching',
    'Other',
] as const;

const SESSION_METHODS = [
    'WhatsApp or direct messages',
    'Google Calendar',
    'Calendly or scheduling tools',
    'Spreadsheets',
    'Other',
] as const;

const PERKS = [
    'Free access during beta',
    'No credit card required to start',
    'Founding Mentor badge on your profile',
    'Priority placement in the marketplace',
    'Personalized social media promotion',
    'Dedicated ad placement through platform channels',
    'AI tools for lesson planning',
    'Full access to all features during beta',
];

const BEST_FOR = [
    'Tutors already working with students',
    'Coaches with active clients',
    'Mentors managing sessions manually',
    'Educators ready to build a structured setup',
];

const ADVANTAGES = [
    'Full access to premium features during beta',
    'Early positioning before the marketplace grows',
    'Priority visibility from day one',
];

type FormData = {
    full_name: string;
    email: string;
    phone_number: string;
    service_description: string;
    category: string;
    category_other: string;
    session_management: string[];
    has_active_clients: '' | 'yes' | 'no';
    biggest_challenge: string;
    referral_source: string;
    profile_link: string;
};

const initialForm: FormData = {
    full_name: '',
    email: '',
    phone_number: '',
    service_description: '',
    category: '',
    category_other: '',
    session_management: [],
    has_active_clients: '',
    biggest_challenge: '',
    referral_source: '',
    profile_link: '',
};

const CheckIcon = () => (
    <svg className="w-5 h-5 text-[#4A148C] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const BetaPage: React.FC = () => {
    const [form, setForm] = useState<FormData>(initialForm);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const formRef = useRef<HTMLDivElement>(null);

    const scrollToForm = () => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleCheckbox = (value: string) => {
        setForm(prev => ({
            ...prev,
            session_management: prev.session_management.includes(value)
                ? prev.session_management.filter(v => v !== value)
                : [...prev.session_management, value],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.full_name.trim() || !form.email.trim() || !form.phone_number.trim() ||
            !form.service_description.trim() || !form.category || !form.biggest_challenge.trim() ||
            !form.referral_source.trim()) {
            setError('Please fill in all required fields.');
            return;
        }
        if (form.session_management.length === 0) {
            setError('Please select at least one session management method.');
            return;
        }
        if (!form.has_active_clients) {
            setError('Please indicate whether you have active clients.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/beta', {
                full_name: form.full_name.trim(),
                email: form.email.trim(),
                phone_number: form.phone_number.trim(),
                service_description: form.service_description.trim(),
                category: form.category,
                category_other: form.category_other.trim() || undefined,
                session_management: form.session_management,
                has_active_clients: form.has_active_clients === 'yes',
                biggest_challenge: form.biggest_challenge.trim(),
                referral_source: form.referral_source.trim(),
                profile_link: form.profile_link.trim() || undefined,
            });
            setSubmitted(true);
            setForm(initialForm);
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Failed to submit. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageLayout>
            <div className="bg-white">

                {/* ── HERO ── */}
                <section className="bg-gradient-to-br from-[#4A148C] to-[#8B55CC] text-white py-24 px-4">
                    <div className="max-w-3xl mx-auto text-center">
                        <span className="inline-block bg-white/15 border border-white/30 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide">
                            Founding Mentor Programme — Limited Spots Only
                        </span>
                        <h1 className="text-3xl md:text-4xl font-bold font-poppins leading-tight mb-6">
                            Join the Founding Mentors<br />
                            Building Something Bigger Than a Marketplace
                        </h1>
                        <p className="text-lg md:text-xl text-white/85 leading-relaxed mb-4 max-w-2xl mx-auto">
                            Turn your tutoring or coaching into a structured, professional business without giving up your earnings.
                        </p>
                        <p className="text-white/70 mb-10">
                            Free access during beta. No credit card required. Setup takes minutes.
                        </p>
                        <button
                            onClick={scrollToForm}
                            className="bg-[#DD5D00] hover:bg-[#c25200] text-white font-semibold px-10 py-4 rounded-full text-lg shadow-lg transition-colors duration-200"
                        >
                            Apply for Beta Access
                        </button>
                    </div>
                </section>

                {/* ── WHAT IS IT ── */}
                <section className="py-20 px-4 bg-white">
                    <div className="max-w-3xl mx-auto text-center">
                        <p className="text-gray-700 text-lg leading-relaxed">
                            <span className="text-[#4A148C] font-semibold">
                                Empower<span className="text-empowered-orange">Ed</span> Learnings
                            </span>{' '}
                            is built for independent
                            tutors, coaches, and mentors who are tired of managing everything manually or relying on platforms
                            that take a cut. We give you a clean, structured system to manage sessions, payments, and your
                            professional presence in one place.
                        </p>
                    </div>
                </section>

                {/* ── WHAT YOU GET ── */}
                <section className="py-20 px-4 bg-[#F3E5F5]">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-bold font-poppins text-[#4A148C] text-center mb-4">
                            What you get as a Founding Mentor
                        </h2>
                        <p className="text-center text-gray-600 mb-10">
                            If selected, you will receive:
                        </p>
                        <ul className="space-y-4">
                            {PERKS.map(perk => (
                                <li key={perk} className="flex items-start gap-3 bg-white rounded-xl px-5 py-4 shadow-sm">
                                    <CheckIcon />
                                    <span className="text-gray-800">{perk}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-8 flex justify-center">
                            <p className="inline-flex items-center rounded-full border border-[#DD5D00]/30 bg-[#FFF3EA] px-6 py-3 text-center text-[#A64300] font-bold text-lg shadow-sm">
                                You are getting early visibility, priority support, and full access from day one.
                            </p>
                        </div>
                    </div>
                </section>

                {/* ── LIMITED SPOTS ── */}
                <section className="py-20 px-4 bg-gradient-to-br from-[#4A148C] to-[#8B55CC] text-white">
                    <div className="max-w-2xl mx-auto text-center">
                        <h2 className="text-3xl md:text-4xl font-bold font-poppins mb-6">
                            Only a limited number of mentors will be accepted
                        </h2>
                        <p className="text-white/85 text-lg leading-relaxed mb-4">
                            We are keeping this beta small so we can work closely with early users and improve the platform
                            based on real usage.
                        </p>
                        <p className="text-white/70 mb-10">
                            Once these spots are filled, access will close.
                        </p>
                        <button
                            onClick={scrollToForm}
                            className="bg-[#DD5D00] hover:bg-[#c25200] text-white font-semibold px-10 py-4 rounded-full text-lg shadow-lg transition-colors duration-200"
                        >
                            Apply now before it fills up
                        </button>
                    </div>
                </section>

                {/* ── FOUNDING MENTOR ADVANTAGE ── */}
                <section className="py-20 px-4 bg-white">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-bold font-poppins text-gray-900 text-center mb-10">
                            Founding Mentor Advantage
                        </h2>
                        <ul className="space-y-4 mb-14">
                            {ADVANTAGES.map(item => (
                                <li key={item} className="flex items-start gap-3">
                                    <CheckIcon />
                                    <span className="text-gray-800 text-lg">{item}</span>
                                </li>
                            ))}
                        </ul>
                        <h3 className="text-2xl font-bold font-poppins text-[#4A148C] mb-6 text-center">
                            This beta is best for:
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {BEST_FOR.map(item => (
                                <div key={item} className="flex items-start gap-3 bg-[#F3E5F5] rounded-xl px-5 py-4">
                                    <CheckIcon />
                                    <span className="text-gray-800">{item}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-center text-gray-700 mt-10 text-lg">
                            Join the first group of mentors building on Empower
                            <span className="text-empowered-orange">Ed</span> Learnings.
                        </p>
                        <p className="text-center text-gray-500 mt-2">
                            No credit card required. Quick setup. Limited spots.
                        </p>
                        <div className="flex justify-center mt-8">
                            <button
                                onClick={scrollToForm}
                                className="bg-[#DD5D00] hover:bg-[#c25200] text-white font-semibold px-10 py-4 rounded-full text-lg shadow-lg transition-colors duration-200"
                            >
                                Apply for Beta Access
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── FORM ── */}
                <section ref={formRef} className="py-20 px-4 bg-[#F3E5F5]" id="beta-form">
                    <div className="max-w-2xl mx-auto">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl md:text-4xl font-bold font-poppins text-[#4A148C] mb-3">
                                Beta Application Form
                            </h2>
                            <p className="text-gray-600">
                                Takes less than 2 minutes. We will reach out if selected.
                            </p>
                        </div>

                        {submitted ? (
                            <div className="bg-white rounded-2xl shadow-lg p-10 text-center">
                                <div className="w-16 h-16 bg-[#F3E5F5] rounded-full flex items-center justify-center mx-auto mb-5">
                                    <svg className="w-8 h-8 text-[#4A148C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-[#4A148C] mb-3">Application Submitted!</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    Thank you for applying to the Empower
                                    <span className="text-empowered-orange">Ed</span> Learnings founding mentor beta
                                    programme. We'll review your application and reach out if you're selected.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 md:p-10 space-y-7">
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                                        {error}
                                    </div>
                                )}

                                {/* Full Name */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Full Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="full_name"
                                        type="text"
                                        value={form.full_name}
                                        onChange={handleChange}
                                        placeholder="Your full name"
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A148C]/40 focus:border-[#4A148C] transition"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Email Address <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="email"
                                        type="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder="you@example.com"
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A148C]/40 focus:border-[#4A148C] transition"
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Phone Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="phone_number"
                                        type="tel"
                                        value={form.phone_number}
                                        onChange={handleChange}
                                        placeholder="+1 555 000 0000"
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A148C]/40 focus:border-[#4A148C] transition"
                                    />
                                </div>

                                {/* Services */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        What type of services do you offer? <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        name="service_description"
                                        value={form.service_description}
                                        onChange={handleChange}
                                        placeholder="e.g. Algebra tutoring, SAT prep, mindset coaching, college applications"
                                        required
                                        rows={3}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A148C]/40 focus:border-[#4A148C] transition resize-none"
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Which category best describes your work? <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="category"
                                        value={form.category}
                                        onChange={handleChange}
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#4A148C]/40 focus:border-[#4A148C] transition bg-white"
                                    >
                                        <option value="">Select a category</option>
                                        {CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Category Other */}
                                {form.category === 'Other' && (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                            Add more details <span className="text-gray-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            name="category_other"
                                            type="text"
                                            value={form.category_other}
                                            onChange={handleChange}
                                            placeholder="Describe your category..."
                                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A148C]/40 focus:border-[#4A148C] transition"
                                        />
                                    </div>
                                )}

                                {/* Session Management */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                                        How are you currently managing your sessions? <span className="text-red-500">*</span>
                                    </label>
                                    <div className="space-y-2.5">
                                        {SESSION_METHODS.map(method => (
                                            <label
                                                key={method}
                                                className="flex items-center gap-3 cursor-pointer group"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={form.session_management.includes(method)}
                                                    onChange={() => handleCheckbox(method)}
                                                    className="w-4 h-4 accent-[#4A148C] flex-shrink-0"
                                                />
                                                <span className="text-gray-700 group-hover:text-[#4A148C] transition-colors">
                                                    {method}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Active Clients */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                                        Do you currently have active students or clients? <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-6">
                                        {(['yes', 'no'] as const).map(val => (
                                            <label key={val} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="has_active_clients"
                                                    value={val}
                                                    checked={form.has_active_clients === val}
                                                    onChange={handleChange}
                                                    className="w-4 h-4 accent-[#4A148C]"
                                                />
                                                <span className="text-gray-700 capitalize">{val === 'yes' ? 'Yes' : 'No'}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Biggest Challenge */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        What is your biggest challenge right now? <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        name="biggest_challenge"
                                        value={form.biggest_challenge}
                                        onChange={handleChange}
                                        placeholder="e.g. Managing bookings, getting more clients, organizing sessions..."
                                        required
                                        rows={3}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A148C]/40 focus:border-[#4A148C] transition resize-none"
                                    />
                                </div>

                                {/* How did you hear about us */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        How did you hear about EmpowerEd Learnings? <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        name="referral_source"
                                        value={form.referral_source}
                                        onChange={handleChange}
                                        placeholder="If someone referred you, please include their name. Otherwise, tell us where you heard about us."
                                        required
                                        rows={2}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A148C]/40 focus:border-[#4A148C] transition resize-none"
                                    />
                                </div>

                                {/* Profile Link */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Link to your profile <span className="text-gray-400 font-normal">(optional)</span>
                                    </label>
                                    <input
                                        name="profile_link"
                                        type="url"
                                        value={form.profile_link}
                                        onChange={handleChange}
                                        placeholder="e.g. Instagram, LinkedIn URL"
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4A148C]/40 focus:border-[#4A148C] transition"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-[#4A148C] hover:bg-[#380e6e] disabled:opacity-60 text-white font-semibold py-4 rounded-full text-lg shadow-md transition-colors duration-200"
                                >
                                    {loading ? 'Submitting...' : 'Submit Application'}
                                </button>
                            </form>
                        )}
                    </div>
                </section>

            </div>
        </PageLayout>
    );
};

export default BetaPage;
