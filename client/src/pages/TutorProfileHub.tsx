import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { User, Book, Layers, DollarSign, ChevronRight, Video } from 'lucide-react';
// Will import section components here later
import { BioSection } from '../components/tutor-profile/BioSection';
import { EducationSection } from '../components/tutor-profile/EducationSection';
import { ServicesSection } from '../components/tutor-profile/ServicesSection';
import { PricingSection } from '../components/tutor-profile/PricingSection';
import { SchedulingSection } from '../components/tutor-profile/SchedulingSection';
import { MarketingVideoSection } from '../components/tutor-profile/MarketingVideoSection';
import api from '../api/axios';

type Section = 'overview' | 'bio' | 'education' | 'services' | 'pricing' | 'scheduling' | 'marketingVideo';

const TutorProfileHub: React.FC = () => {
    const [activeSection, setActiveSection] = useState<Section>('overview');
    const navigate = useNavigate();

    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/tutor/me');
                setProfile(res.data);
            } catch (err) {
                console.error('Failed to fetch profile', err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const checklist = useMemo(() => {
        const p = profile || {};
        return {
            photo: !!p.profile_photo,
            tagline: !!p.tagline,
            about: !!p.about,
            country: !!p.country,
            education: Array.isArray(p.education) && p.education.length > 0,
            strengths: !!p.key_strengths,
            services: Array.isArray(p.categories) && p.categories.length > 0,
            pricing: !!p.hourly_rate,
        };
    }, [profile]);

    const completionPercentage = useMemo(() => {
        const values = Object.values(checklist);
        if (!values.length) return 0;
        const completedCount = values.filter(Boolean).length;
        return Math.round((completedCount / values.length) * 100);
    }, [checklist]);

    const sectionCompletion = useMemo(() => {
        const bio = [checklist.photo, checklist.tagline, checklist.about, checklist.country];
        const education = [checklist.education, checklist.strengths];
        const services = [checklist.services];
        const pricing = [checklist.pricing];

        const pct = (arr: boolean[]) => Math.round((arr.filter(Boolean).length / arr.length) * 100);
        return {
            bio: pct(bio),
            education: pct(education),
            services: pct(services),
            pricing: pct(pricing),
        };
    }, [checklist]);

    const renderContent = () => {
        switch (activeSection) {
            case 'bio': return <BioSection onBack={() => setActiveSection('overview')} />;
            case 'education': return <EducationSection onBack={() => setActiveSection('overview')} />;
            case 'services': return <ServicesSection onBack={() => setActiveSection('overview')} />;
            case 'pricing': return <PricingSection onBack={() => setActiveSection('overview')} />;
            case 'scheduling': return <SchedulingSection onBack={() => setActiveSection('overview')} />;
            case 'marketingVideo': return <MarketingVideoSection onBack={() => setActiveSection('overview')} tutorUsername={profile?.username} />;
            default: return renderOverview();
        }
    };

    const renderOverview = () => (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to your Profile section!</h2>
                        <p className="text-gray-600">Navigate to any section of your profile to view, add or modify related info.</p>
                    </div>
                    <Button
                        onClick={() => navigate('/profile/preview')}
                        className="bg-[#4A1D96] text-white rounded-full px-6 py-3 flex items-center gap-2 shadow-lg hover:shadow-xl hover:bg-[#3a1676] transition-all whitespace-nowrap"
                    >
                        <span>👁️</span>
                        View Public Profile
                    </Button>
                </div>

                <div className="mt-6">
                    <div className="flex justify-between items-center text-sm font-medium mb-2">
                        <span>Profile Completion</span>
                        <span className={completionPercentage === 100 ? 'text-green-600' : 'text-red-500'}>
                            {completionPercentage}%
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                            className={`${completionPercentage === 100 ? 'bg-green-500' : 'bg-red-500'} h-3 rounded-full transition-all duration-500`}
                            style={{ width: `${completionPercentage}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Complete your profile to start receiving student bookings</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {/* Bio Card */}
                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
                    onClick={() => setActiveSection('bio')}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                Bio
                                {sectionCompletion.bio === 100 ? (
                                    <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100">Complete</span>
                                ) : (
                                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">Action Required</span>
                                )}
                            </h3>
                            <p className="text-sm text-gray-500 max-w-lg mt-1">
                                Bio includes personal details such as a profile photo, a self-introduction, language proficiency, and country details.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`text-xs font-bold px-2 py-1 rounded ${sectionCompletion.bio === 100 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {sectionCompletion.bio}%
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                </Card>

                {/* Education Card */}
                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
                    onClick={() => setActiveSection('education')}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                            <Book className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                Education & Expertise
                                {sectionCompletion.education === 100 ? (
                                    <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100">Complete</span>
                                ) : (
                                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">Action Required</span>
                                )}
                            </h3>
                            <p className="text-sm text-gray-500 max-w-lg mt-1">
                                Education & Expertise includes education, professional experience, achievements/certificates, external reviews, and key strengths.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`text-xs font-bold px-2 py-1 rounded ${sectionCompletion.education === 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {sectionCompletion.education}%
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                </Card>

                {/* Services Card */}
                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
                    onClick={() => setActiveSection('services')}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                Services
                                {sectionCompletion.services === 100 ? (
                                    <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100">Complete</span>
                                ) : (
                                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">Action Required</span>
                                )}
                            </h3>
                            <p className="text-sm text-gray-500 max-w-lg mt-1">
                                It includes listing your expertise across one or more main categories so students can easily find you.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {sectionCompletion.services === 100 ? (
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                        ) : (
                            <div className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded">{sectionCompletion.services}%</div>
                        )}
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                </Card>

                {/* Pricing Card */}
                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
                    onClick={() => setActiveSection('pricing')}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                Pricing
                                {sectionCompletion.pricing === 100 ? (
                                    <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100">Complete</span>
                                ) : (
                                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">Action Required</span>
                                )}
                            </h3>
                            <p className="text-sm text-gray-500 max-w-lg mt-1">
                                Pricing includes the rates for your 50-minute lessons.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`text-xs font-bold px-2 py-1 rounded ${sectionCompletion.pricing === 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {sectionCompletion.pricing}%
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                </Card>

                {/* Scheduling Card */}
                <Card
                    className="p-6 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
                    onClick={() => setActiveSection('scheduling')}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                            <span className="text-lg">🗓️</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                Scheduling
                                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">New</span>
                            </h3>
                            <p className="text-sm text-gray-500 max-w-lg mt-1">
                                Set your weekly working hours and add time-off blocks so students can only book when you are available.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                </Card>

                {['PRO', 'PREMIUM'].includes(profile?.tier) && (
                    <Card
                        className="p-6 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
                        onClick={() => setActiveSection('marketingVideo')}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                                <Video className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    Marketing Video Submission
                                    <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-100">Pro/Premium</span>
                                </h3>
                                <p className="text-sm text-gray-500 max-w-lg mt-1">
                                    Submit your marketing video link and preferences for campaigns. Not part of profile completion.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );

    return (
        <DashboardLayout>
            <div className="w-full px-4 sm:px-6 lg:px-8">
                {activeSection === 'overview' && (
                    <Button variant="ghost" className="mb-4 text-gray-500" onClick={() => navigate('/dashboard')}>
                        &larr; Back to Dashboard
                    </Button>
                )}
                {loading ? <div className="p-6 text-center">Loading profile...</div> : renderContent()}
            </div>
        </DashboardLayout>
    );
};

export default TutorProfileHub;
