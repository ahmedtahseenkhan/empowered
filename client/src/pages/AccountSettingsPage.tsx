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
    const { user } = useAuth();

    const [me, setMe] = useState<MeResponse['user'] | null>(null);
    const [loading, setLoading] = useState(true);

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
            } catch (e) {
                console.error('Failed to load account', e);
            } finally {
                setLoading(false);
            }
        };

        fetchMe();
    }, []);

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

                {loading ? (
                    <div className="text-gray-600">Loading...</div>
                ) : (
                    <Card className="p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Account</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Name" value={me?.username || user?.username || ''} disabled />
                            <Input label="Email" value={me?.email || user?.email || ''} disabled />
                        </div>
                    </Card>
                )}

                <Card className="p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Change Password</h2>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
                            {success}
                        </div>
                    )}

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
