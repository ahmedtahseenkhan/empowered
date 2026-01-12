import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import api from '../../api/axios';

interface BioSectionProps {
    onBack: () => void;
}

export const BioSection: React.FC<BioSectionProps> = ({ onBack }) => {
    const [formData, setFormData] = useState({
        tagline: '',
        about: '',
        country: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/tutor/me');
                setFormData({
                    tagline: res.data.tagline || '',
                    about: res.data.about || '',
                    country: res.data.country || '',
                });
                if (res.data.profile_photo) {
                    setProfilePhoto(res.data.profile_photo);
                }
            } catch (err) {
                console.error("Failed to fetch profile", err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setProfilePhoto(result);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/tutor/me/bio', {
                ...formData,
                profile_photo: profilePhoto,
            });
            onBack();
        } catch (err) {
            console.error("Failed to save profile", err);
            alert("Failed to save changes. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6 text-center">Loading profile...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={onBack}>&larr; Back</Button>
                <h2 className="text-2xl font-bold text-gray-900">Bio</h2>
            </div>

            <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Profile Photo</h3>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                >
                    {profilePhoto ? (
                        <div className="flex flex-col items-center gap-3">
                            <img
                                src={profilePhoto}
                                alt="Profile preview"
                                className="w-24 h-24 rounded-full object-cover border border-gray-200"
                            />
                            <span className="text-sm text-gray-600 font-medium">Change Photo</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                            <span className="text-sm font-medium">Upload a photo</span>
                            <span className="text-xs">JPG or PNG</span>
                        </div>
                    )}
                </button>
            </Card>

            <Card className="p-6 space-y-4">
                <h3 className="font-bold text-lg">Self Introduction</h3>
                <Input
                    label="Profile Tagline"
                    name="tagline"
                    value={formData.tagline}
                    onChange={handleChange}
                    placeholder="A short headline about yourself"
                />

                <Input
                    label="Country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="e.g. United States"
                />

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">A paragraph about yourself</label>
                    <textarea
                        name="about"
                        value={formData.about}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 min-h-[150px]"
                        placeholder="Describe your background and teaching style..."
                    ></textarea>
                </div>
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack} disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
};
