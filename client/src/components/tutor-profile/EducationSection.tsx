import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Award, BookOpen, Star, Upload, X, Trash2 } from 'lucide-react';
import api from '../../api/axios';

interface EducationSectionProps {
    onBack: () => void;
}

interface Certification {
    id?: string;
    name: string;
    issuer: string;
    year: number;
    image_url?: string;
    is_verified?: boolean;
}
interface ExternalReview {
    id?: string;
    platform: string;
    reviewer: string;
    rating: number;
    comment: string;
    date?: string;
}

const YEARS = Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - i);

export const EducationSection: React.FC<EducationSectionProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form States
    const [degree, setDegree] = useState('');
    const [fieldOfStudy, setFieldOfStudy] = useState('');
    const [institution, setInstitution] = useState('');
    const [gradYear, setGradYear] = useState('');

    const [experienceYears, setExperienceYears] = useState('0'); // Total years
    const [keyStrengths, setKeyStrengths] = useState('');

    const [certifications, setCertifications] = useState<Certification[]>([]);
    const [externalReviews, setExternalReviews] = useState<ExternalReview[]>([]);

    // UI States for adding new items
    const [isAddingCert, setIsAddingCert] = useState(false);
    const [newCert, setNewCert] = useState<Partial<Certification>>({ year: new Date().getFullYear() });
    const [newCertFileName, setNewCertFileName] = useState<string | null>(null);
    const certFileInputRef = useRef<HTMLInputElement | null>(null);

    const [isAddingReview, setIsAddingReview] = useState(false);
    const [newReview, setNewReview] = useState<Partial<ExternalReview>>({ rating: 5 });

    useEffect(() => {
        const fetchProfile = async () => {
            // Mock User Username for Welcome fallback
            try {
                const res = await api.get('/tutor/me');
                const p = res.data;

                // Education (Assuming single primary for now based on UI screenshot, or pick first)
                if (p.education && p.education.length > 0) {
                    const edu = p.education[0];
                    setDegree(edu.degree || '');
                    setFieldOfStudy(edu.field_of_study || '');
                    setInstitution(edu.institution || '');
                    setGradYear(edu.year ? edu.year.toString() : '');
                }

                // Experience Years
                if (p.experience_years) setExperienceYears(p.experience_years.toString());

                // Key Strengths
                if (p.key_strengths) setKeyStrengths(p.key_strengths);

                // Certifications
                if (p.certifications) setCertifications(p.certifications);

                // External Reviews
                if (p.external_reviews) setExternalReviews(p.external_reviews);

            } catch (err) {
                console.error("Failed to load profile", err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Update Bio for Key Strengths (shared endpoint)
            await api.put('/tutor/me/bio', {
                key_strengths: keyStrengths,
                experience_years: parseInt(experienceYears, 10) || 0,
            });

            // Build Education Object (Single for now as per simple UI)
            const educationData = degree && institution ? [{
                institution,
                degree,
                field_of_study: fieldOfStudy,
                year: parseInt(gradYear) || new Date().getFullYear()
            }] : [];

            // Execute Updates
            await Promise.all([
                api.put('/tutor/me/education', {
                    education: educationData,
                    certifications: certifications
                }),
                api.put('/tutor/me/external-reviews', { external_reviews: externalReviews })
            ]);

            onBack();
        } catch (err) {
            console.error("Failed to save", err);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    // Helper functions for Certifications
    const handleAddCert = () => {
        if (newCert.name && newCert.issuer) {
            setCertifications([...certifications, {
                name: newCert.name,
                issuer: newCert.issuer,
                year: newCert.year || new Date().getFullYear(),
                image_url: newCert.image_url,
                is_verified: false
            }]);
            setNewCert({ year: new Date().getFullYear() });
            setNewCertFileName(null);
            setIsAddingCert(false);
        }
    };

    const handleRemoveCert = (index: number) => {
        const newCerts = [...certifications];
        newCerts.splice(index, 1);
        setCertifications(newCerts);
    };

    // Helper functions for Reviews
    const handleAddReview = () => {
        if (newReview.reviewer && newReview.platform) {
            setExternalReviews([...externalReviews, {
                platform: newReview.platform,
                reviewer: newReview.reviewer,
                rating: newReview.rating || 5,
                comment: newReview.comment || '',
                date: new Date().toISOString()
            }]);
            setNewReview({ rating: 5 });
            setIsAddingReview(false);
        }
    };

    const handleRemoveReview = (index: number) => {
        const newRevs = [...externalReviews];
        newRevs.splice(index, 1);
        setExternalReviews(newRevs);
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={onBack}>&larr; Back</Button>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-[#4A1D96]">Welcome Back {localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).username : ''}</h2>
                    <p className="text-gray-600">Build your Profile</p>
                </div>
            </div>

            <div className="bg-[#4A1D96] text-white p-4 rounded-t-xl font-bold text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Education & Expertise
            </div>

            <div className="space-y-6">

                {/* 1. Educational Details */}
                <Card className="p-6">
                    <h3 className="font-bold text-lg mb-4">Educational Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select your degree</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                value={degree}
                                onChange={(e) => setDegree(e.target.value)}
                            >
                                <option value="">Select...</option>
                                <option value="Bachelors">Bachelor's</option>
                                <option value="Masters">Master's</option>
                                <option value="PhD">PhD</option>
                                <option value="Associate">Associate</option>
                            </select>
                        </div>
                        <Input
                            label="Field of Study (Major)*"
                            value={fieldOfStudy}
                            onChange={(e) => setFieldOfStudy(e.target.value)}
                            placeholder="your field of study ..."
                        />
                        <Input
                            label="Institution Name"
                            value={institution}
                            onChange={(e) => setInstitution(e.target.value)}
                            placeholder="Your Institution name ..."
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Graduation Year</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                value={gradYear}
                                onChange={(e) => setGradYear(e.target.value)}
                            >
                                <option value="">Select Year</option>
                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="outline" onClick={onBack} disabled={saving}>Cancel</Button>
                        <Button className="bg-[#4A1D96] text-white" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                    </div>
                </Card>

                {/* 2. Professional Experience */}
                <Card className="p-6">
                    <h3 className="font-bold text-lg mb-4">Professional Experience</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Years of Experience</label>
                        <select
                            className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                            value={experienceYears}
                            onChange={(e) => setExperienceYears(e.target.value)}
                        >
                            <option value="0">0-1 Years</option>
                            <option value="2">2-5 Years</option>
                            <option value="5">5-10 Years</option>
                            <option value="10">10+ Years</option>
                        </select>
                    </div>
                </Card>

                {/* 3. Certifications */}
                <Card className="p-6">
                    <h3 className="font-bold text-lg mb-4">Certifications/Achievements</h3>
                    <div className="bg-[#F3F0FF] border border-[#4A1D96] rounded-lg p-4 mb-4 flex gap-3">
                        <Award className="w-5 h-5 text-[#4A1D96] flex-shrink-0 mt-1" />
                        <div className="text-xs text-[#4A1D96]">
                            <strong>Admin Verification Required</strong><br />
                            All certificates and achievements must be verified by our admin team before they become visible to students. Items marked as "Pending" will not appear in your public profile until approved.
                        </div>
                    </div>

                    {certifications.length === 0 && !isAddingCert ? (
                        <div className="text-center py-6 text-[#4A1D96] font-medium">
                            No Certifications/Achievements added yet
                        </div>
                    ) : (
                        <div className="space-y-3 mb-6">
                            {certifications.map((cert, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                                    <div>
                                        <p className="font-semibold">{cert.name}</p>
                                        <p className="text-sm text-gray-500">{cert.issuer} ({cert.year})</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Pending</span>
                                        <button onClick={() => handleRemoveCert(idx)} className="text-red-400 hover:text-red-600">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {isAddingCert ? (
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
                            <h4 className="font-semibold text-gray-900">Add New Certification</h4>
                            <Input
                                label="Certification Heading"
                                value={newCert.name || ''}
                                onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                                placeholder="Java Programming Certification"
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Issuer"
                                    value={newCert.issuer || ''}
                                    onChange={(e) => setNewCert({ ...newCert, issuer: e.target.value })}
                                    placeholder="e.g. Coursera, Oracle"
                                />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                                        value={newCert.year}
                                        onChange={(e) => setNewCert({ ...newCert, year: parseInt(e.target.value) })}
                                    >
                                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Image Upload Mock */}
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-white">
                                <input
                                    ref={certFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        setNewCertFileName(file.name);
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            const result = reader.result as string;
                                            setNewCert(prev => ({ ...prev, image_url: result }));
                                        };
                                        reader.readAsDataURL(file);
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => certFileInputRef.current?.click()}
                                    className="w-full flex flex-col items-center gap-2 text-gray-500 hover:text-[#4A1D96]"
                                >
                                    <Upload className="w-8 h-8 text-[#4A1D96]" />
                                    <span className="text-sm font-medium">
                                        {newCertFileName ? 'Change File' : 'Upload a File'}
                                    </span>
                                    <span className="text-xs">
                                        {newCertFileName || 'JPG, PNG'}
                                    </span>
                                </button>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsAddingCert(false)}>Cancel</Button>
                                <Button className="bg-[#4A1D96] text-white" size="sm" onClick={handleAddCert}>Add</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-right">
                            <Button className="bg-[#4A1D96] text-white rounded-full" onClick={() => setIsAddingCert(true)}>Add Certification</Button>
                        </div>
                    )}
                </Card>

                {/* 4. External Reviews */}
                <Card className="p-6">
                    <h3 className="font-bold text-lg mb-4">External Reviews</h3>
                    <div className="bg-white border invalid:border-red-500 border-gray-200 rounded-lg p-4 mb-4 flex gap-3 shadow-sm">
                        <Star className="w-5 h-5 text-[#4A1D96] flex-shrink-0 mt-1" />
                        <div className="text-xs text-gray-600">
                            Pro & Premium feature: Members can add external reviews (Google, Facebook, etc.), which must be verified by our admin team.
                        </div>
                    </div>

                    {externalReviews.length === 0 && !isAddingReview ? (
                        <div className="text-center py-6 text-[#4A1D96] font-medium">
                            No reviews added yet
                        </div>
                    ) : (
                        <div className="space-y-3 mb-6">
                            {externalReviews.map((rev, idx) => (
                                <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-100 relative">
                                    <button onClick={() => handleRemoveReview(idx)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-semibold block">{rev.reviewer}</span>
                                            <span className="text-xs text-gray-500">{rev.platform}</span>
                                        </div>
                                        <div className="flex items-center text-yellow-500 text-sm font-bold">
                                            {rev.rating} <Star className="w-3 h-3 ml-1 fill-current" />
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 italic">"{rev.comment}"</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {isAddingReview ? (
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
                            <h4 className="font-semibold text-gray-900">Add New Review</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Platform"
                                    value={newReview.platform || ''}
                                    onChange={(e) => setNewReview({ ...newReview, platform: e.target.value })}
                                    placeholder="e.g. Google, LinkedIn"
                                />
                                <Input
                                    label="Reviewer Name"
                                    value={newReview.reviewer || ''}
                                    onChange={(e) => setNewReview({ ...newReview, reviewer: e.target.value })}
                                    placeholder="Client Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            className={`p-1 rounded ${newReview.rating && newReview.rating >= star ? 'text-yellow-500' : 'text-gray-300'}`}
                                            onClick={() => setNewReview({ ...newReview, rating: star })}
                                        >
                                            <Star className="w-6 h-6 fill-current" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                                <textarea
                                    className="w-full border border-gray-300 rounded-lg p-3 text-sm"
                                    rows={3}
                                    value={newReview.comment || ''}
                                    onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                                    placeholder="Paste the review content here..."
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsAddingReview(false)}>Cancel</Button>
                                <Button className="bg-[#4A1D96] text-white" size="sm" onClick={handleAddReview}>Add</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-right">
                            <Button className="bg-[#4A1D96] text-white rounded-full" onClick={() => setIsAddingReview(true)}>Add Review</Button>
                        </div>
                    )}
                </Card>

                {/* 5. Key Strengths */}
                <Card className="p-6">
                    <h3 className="font-bold text-lg mb-4">Key strengths</h3>
                    <div className="bg-[#F3F0FF] border border-[#4A1D96] rounded-lg p-3 mb-4 flex gap-2 items-center justify-center text-xs font-semibold text-[#4A1D96]">
                        <Award className="w-4 h-4" /> Highlight what makes you unique and stand out as a mentor.
                    </div>

                    <textarea
                        className="w-full border border-gray-300 rounded-lg p-4 min-h-[120px] text-sm"
                        placeholder="Mention skills, experience, or techniques that set you apart..."
                        value={keyStrengths}
                        onChange={(e) => setKeyStrengths(e.target.value)}
                    ></textarea>
                </Card>
            </div>

            <div className="flex justify-end mt-8">
                <Button className="bg-[#4A1D96] text-white px-8 py-3 rounded-full text-lg" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Continue'}</Button>
            </div>
        </div>
    );
};
