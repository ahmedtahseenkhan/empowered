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
        facebook_url: '',
        instagram_url: '',
        linkedin_url: '',
        twitter_url: '',
        youtube_url: '',
        tiktok_url: '',
        website_url: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
    // Track whether the user picked a NEW photo this session. The existing photo is
    // stored as a large base64 data URL, so re-sending it on every text-only edit can
    // exceed the server body limit (413) and fail the save. Only send it when changed.
    const [photoChanged, setPhotoChanged] = useState(false);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/tutor/me');
                setFormData({
                    tagline: res.data.tagline || '',
                    about: res.data.about || '',
                    country: res.data.country || '',
                    facebook_url: res.data.facebook_url || '',
                    instagram_url: res.data.instagram_url || '',
                    linkedin_url: res.data.linkedin_url || '',
                    twitter_url: res.data.twitter_url || '',
                    youtube_url: res.data.youtube_url || '',
                    tiktok_url: res.data.tiktok_url || '',
                    website_url: res.data.website_url || '',
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

    // Downscale + recompress to a small JPEG before upload. Profile photos only need
    // to render at avatar size, so we cap the largest dimension and use JPEG quality
    // to keep files ~100-300 KB instead of multi-MB originals.
    const resizeImage = (dataUrl: string, maxDim = 600, quality = 0.82): Promise<string> =>
        new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height && width > maxDim) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else if (height >= width && height > maxDim) {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(dataUrl); // fall back to original if canvas unavailable
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error('Could not read the selected image.'));
            img.src = dataUrl;
        });

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const result = reader.result as string;
            try {
                const resized = await resizeImage(result);
                setProfilePhoto(resized);
            } catch {
                setProfilePhoto(result); // worst case, upload the original
            }
            setPhotoChanged(true);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: Record<string, unknown> = { ...formData };

            // Only touch the photo when the user picked a new one. Upload it as a real
            // file first and store just the returned URL — never the raw base64 blob,
            // which bloats the DB and can exceed the request body limit on later saves.
            if (photoChanged && profilePhoto?.startsWith('data:')) {
                const uploadRes = await api.post('/uploads/image', { dataUrl: profilePhoto });
                payload.profile_photo = uploadRes.data.url;
            }

            await api.put('/tutor/me/bio', payload);
            onBack();
        } catch (err: any) {
            console.error("Failed to save profile", err);
            const status = err?.response?.status;
            const serverMsg = err?.response?.data?.error as string | undefined;
            alert(
                status === 413 || /too large/i.test(serverMsg || '')
                    ? "Your profile photo is too large. Please choose a smaller image (under 5MB)."
                    : (serverMsg || "Failed to save changes. Please try again.")
            );
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
                            <img loading="lazy" decoding="async"
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

            <Card className="p-6 space-y-4">
                <div>
                    <h3 className="font-bold text-lg">Social Links</h3>
                    <p className="text-sm text-gray-500 mt-1">Optional. Add the full URL — these appear on your public profile.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Website" name="website_url" value={formData.website_url} onChange={handleChange} placeholder="https://yourwebsite.com" />
                    <Input label="LinkedIn" name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} placeholder="https://linkedin.com/in/username" />
                    <Input label="Instagram" name="instagram_url" value={formData.instagram_url} onChange={handleChange} placeholder="https://instagram.com/username" />
                    <Input label="Facebook" name="facebook_url" value={formData.facebook_url} onChange={handleChange} placeholder="https://facebook.com/username" />
                    <Input label="X (Twitter)" name="twitter_url" value={formData.twitter_url} onChange={handleChange} placeholder="https://x.com/username" />
                    <Input label="YouTube" name="youtube_url" value={formData.youtube_url} onChange={handleChange} placeholder="https://youtube.com/@channel" />
                    <Input label="TikTok" name="tiktok_url" value={formData.tiktok_url} onChange={handleChange} placeholder="https://tiktok.com/@username" />
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
