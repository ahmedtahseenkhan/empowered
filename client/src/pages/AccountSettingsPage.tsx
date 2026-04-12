import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

type MeResponse = {
    user: {
        id: string;
        email: string;
        role: 'STUDENT' | 'TUTOR' | 'ADMIN';
        username?: string;
    };
};

const AccountSettingsPage: React.FC = () => {
    const { user, login: refreshAuth } = useAuth();

    const [me, setMe] = useState<MeResponse['user'] | null>(null);
    const [loading, setLoading] = useState(true);

    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');
    const [savingName, setSavingName] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const fetchMe = async () => {
            try {
                setLoading(true);
                const res = await api.get<MeResponse>('/auth/me');
                setMe(res.data.user);
                setNameValue(res.data.user.username || '');
            } catch (e) {
                console.error('Failed to load account', e);
            } finally {
                setLoading(false);
            }
        };

        fetchMe();
    }, []);

    const handleSaveName = async () => {
        setError('');
        setSuccess('');
        if (!nameValue.trim()) {
            setError('Name cannot be empty.');
            return;
        }
        setSavingName(true);
        try {
            await api.put('/auth/update-profile', { username: nameValue.trim() });
            setMe(prev => prev ? { ...prev, username: nameValue.trim() } : prev);
            setEditingName(false);
            setSuccess('Name updated successfully.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update name');
        } finally {
            setSavingName(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!currentPassword || !newPassword) {
            setError('Please enter your current password and a new password.');
            return;
        }

        setSavingPassword(true);
        try {
            await api.post('/auth/change-password', { currentPassword, newPassword });
            setCurrentPassword('');
            setNewPassword('');
            setSuccess('Password updated successfully.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update password');
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="w-full space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
                    <p className="text-gray-600 mt-1">Manage your account information and password.</p>
                </div>

                {(error || success) && (
                    <div className={`px-4 py-3 rounded-lg text-sm border ${
                        error
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-green-50 border-green-200 text-green-700'
                    }`}>
                        {error || success}
                    </div>
                )}

                {loading ? (
                    <div className="text-gray-600">Loading...</div>
                ) : (
                    <Card className="p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Account Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Editable Name field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                {editingName ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={nameValue}
                                            onChange={e => setNameValue(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                                            autoFocus
                                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                        />
                                        <Button size="sm" onClick={handleSaveName} disabled={savingName}>
                                            {savingName ? 'Saving…' : 'Save'}
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => { setEditingName(false); setNameValue(me?.username || ''); }}>
                                            Cancel
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-900">
                                            {me?.username || user?.username || '—'}
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => setEditingName(true)}>
                                            Edit
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <Input label="Email" value={me?.email || user?.email || ''} disabled />
                        </div>
                    </Card>
                )}

                <Card className="p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Change Password</h2>

                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <Input
                            label="Current Password"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                        />
                        <Input
                            label="New Password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                        />

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <Button type="submit" disabled={savingPassword}>
                                {savingPassword ? 'Updating...' : 'Update Password'}
                            </Button>
                            <Button as={Link} to="/forgot-password" variant="ghost" type="button">
                                Forgot password?
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default AccountSettingsPage;

