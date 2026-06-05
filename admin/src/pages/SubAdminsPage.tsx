import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Mail, Plus, Trash2, Pencil, X, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { GRANTABLE_MODULES } from '../lib/permissions';

interface SubAdmin {
    id: string;
    userId: string;
    email: string;
    username: string;
    permissions: string[];
    isSuspended: boolean;
    createdAt?: string;
}

interface FormState {
    email: string;
    password: string;
    username: string;
    permissions: string[];
}

const emptyForm: FormState = { email: '', password: '', username: '', permissions: [] };

const SubAdminsPage: React.FC = () => {
    const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<SubAdmin | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchSubAdmins = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/sub-admins');
            setSubAdmins(res.data.subAdmins);
        } catch (e) {
            console.error('Failed to fetch sub-admins', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubAdmins();
    }, []);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setError('');
        setModalOpen(true);
    };

    const openEdit = (sa: SubAdmin) => {
        setEditing(sa);
        setForm({ email: sa.email, password: '', username: sa.username, permissions: [...sa.permissions] });
        setError('');
        setModalOpen(true);
    };

    const togglePermission = (key: string) => {
        setForm((f) => ({
            ...f,
            permissions: f.permissions.includes(key)
                ? f.permissions.filter((k) => k !== key)
                : [...f.permissions, key],
        }));
    };

    const handleSave = async () => {
        setError('');
        if (!editing) {
            if (!form.email.trim() || !form.username.trim() || !form.password) {
                setError('Email, username, and password are required.');
                return;
            }
            if (form.password.length < 8) {
                setError('Password must be at least 8 characters.');
                return;
            }
        }
        setSaving(true);
        try {
            if (editing) {
                await api.put(`/admin/sub-admins/${editing.id}`, {
                    username: form.username.trim(),
                    permissions: form.permissions,
                });
            } else {
                await api.post('/admin/sub-admins', {
                    email: form.email.trim(),
                    password: form.password,
                    username: form.username.trim(),
                    permissions: form.permissions,
                });
            }
            setModalOpen(false);
            await fetchSubAdmins();
        } catch (e) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg || 'Failed to save sub-admin.');
        } finally {
            setSaving(false);
        }
    };

    const toggleSuspend = async (sa: SubAdmin) => {
        try {
            await api.put(`/admin/sub-admins/${sa.id}`, { isSuspended: !sa.isSuspended });
            await fetchSubAdmins();
        } catch (e) {
            console.error('Failed to update sub-admin', e);
        }
    };

    const handleDelete = async (sa: SubAdmin) => {
        if (!window.confirm(`Remove sub-admin "${sa.username}"? This deletes their account.`)) return;
        try {
            await api.delete(`/admin/sub-admins/${sa.id}`);
            await fetchSubAdmins();
        } catch (e) {
            console.error('Failed to delete sub-admin', e);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-primary-700" /> Sub-Admins
                    </h1>
                    <p className="text-gray-600 mt-1">Create sub-admins and control which modules they can access.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Add Sub-Admin
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading sub-admins...</div>
                ) : subAdmins.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No sub-admins yet. Create one to get started.</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub-Admin</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {subAdmins.map((sa) => (
                                <tr key={sa.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{sa.username}</div>
                                        <div className="text-sm text-gray-500 flex items-center gap-1">
                                            <Mail className="w-3 h-3" /> {sa.email}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {sa.permissions.length === 0 ? (
                                            <span className="text-xs text-gray-400">No access</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1 max-w-md">
                                                {sa.permissions.map((p) => {
                                                    const mod = GRANTABLE_MODULES.find((m) => m.key === p);
                                                    return (
                                                        <span key={p} className="px-2 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-700 border border-primary-100">
                                                            {mod?.label || p}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={cn(
                                            "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                                            sa.isSuspended ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                                        )}>
                                            {sa.isSuspended ? 'Deactivated' : 'Active'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                        <button onClick={() => openEdit(sa)} className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1">
                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button onClick={() => toggleSuspend(sa)} className="text-amber-600 hover:text-amber-800">
                                            {sa.isSuspended ? 'Reactivate' : 'Deactivate'}
                                        </button>
                                        <button onClick={() => handleDelete(sa)} className="text-red-600 hover:text-red-800 inline-flex items-center gap-1">
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900">
                                {editing ? 'Edit Sub-Admin' : 'Add Sub-Admin'}
                            </h2>
                            <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-6 py-4 space-y-4">
                            {error && (
                                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={form.username}
                                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>

                            {!editing && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                        <input
                                            type="password"
                                            value={form.password}
                                            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                                            placeholder="At least 8 characters"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Module Access</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {GRANTABLE_MODULES.map((m) => (
                                        <label key={m.key} className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                checked={form.permissions.includes(m.key)}
                                                onChange={() => togglePermission(m.key)}
                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            {m.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-60"
                            >
                                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Sub-Admin'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubAdminsPage;
