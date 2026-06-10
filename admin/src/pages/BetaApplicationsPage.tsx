import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

type BetaStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface BetaApplication {
    id: string;
    full_name: string;
    email: string;
    phone_number: string;
    service_description: string;
    category: string;
    category_other: string | null;
    session_management: string[];
    has_active_clients: boolean;
    biggest_challenge: string;
    referral_source: string;
    profile_link: string | null;
    status: BetaStatus;
    actioned_at: string | null;
    created_at: string;
}

const STATUS_FILTERS: { label: string; value: string }[] = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
];

const StatusBadge: React.FC<{ status: BetaStatus }> = ({ status }) => {
    const styles: Record<BetaStatus, string> = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        APPROVED: 'bg-green-100 text-green-800',
        REJECTED: 'bg-red-100 text-red-800',
    };
    const icons: Record<BetaStatus, React.ReactNode> = {
        PENDING: <Clock className="w-3.5 h-3.5" />,
        APPROVED: <CheckCircle className="w-3.5 h-3.5" />,
        REJECTED: <XCircle className="w-3.5 h-3.5" />,
    };
    return (
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold', styles[status])}>
            {icons[status]}
            {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
    );
};

const BetaApplicationsPage: React.FC = () => {
    const [applications, setApplications] = useState<BetaApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const fetchApplications = async (status = filterStatus) => {
        setLoading(true);
        try {
            const params = status ? `?status=${status}` : '';
            const { data } = await api.get(`/admin/beta-applications${params}`);
            setApplications(data.applications);
        } catch {
            showToast('Failed to load applications.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications(filterStatus);
    }, [filterStatus]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        setActionLoading(id + action);
        try {
            await api.put(`/admin/beta-applications/${id}/${action}`);
            showToast(
                action === 'approve'
                    ? 'Application approved. Acceptance email sent.'
                    : 'Application rejected.',
                'success',
            );
            setApplications(prev =>
                prev.map(a =>
                    a.id === id
                        ? { ...a, status: action === 'approve' ? 'APPROVED' : 'REJECTED', actioned_at: new Date().toISOString() }
                        : a,
                ),
            );
        } catch (err: any) {
            showToast(err?.response?.data?.error || 'Action failed. Please try again.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const toggleExpand = (id: string) => setExpandedId(prev => (prev === id ? null : id));

    const pendingCount = applications.filter(a => a.status === 'PENDING').length;

    return (
        <div>
            {/* Toast */}
            {toast && (
                <div
                    className={cn(
                        'fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all',
                        toast.type === 'success' ? 'bg-green-600' : 'bg-red-600',
                    )}
                >
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Beta Applications</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Founding Mentor Programme — First 50 spots
                        {pendingCount > 0 && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                {pendingCount} pending
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setFilterStatus(f.value)}
                        className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                            filterStatus === f.value
                                ? 'bg-primary-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
                </div>
            ) : applications.length === 0 ? (
                <div className="text-center py-24 text-gray-400 text-sm">No applications found.</div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Applicant</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Category</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Applied</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Actions</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {applications.map(app => (
                                <React.Fragment key={app.id}>
                                    <tr className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-4">
                                            <p className="font-medium text-gray-900">{app.full_name}</p>
                                            <p className="text-gray-500 text-xs mt-0.5">{app.email}</p>
                                            <p className="text-gray-400 text-xs">{app.phone_number}</p>
                                        </td>
                                        <td className="px-5 py-4 text-gray-700">
                                            {app.category_other ? `${app.category} — ${app.category_other}` : app.category}
                                        </td>
                                        <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                                            {new Date(app.created_at).toLocaleDateString('en-GB', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-5 py-4">
                                            <StatusBadge status={app.status} />
                                        </td>
                                        <td className="px-5 py-4">
                                            {app.status === 'PENDING' ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleAction(app.id, 'approve')}
                                                        disabled={!!actionLoading}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                                                    >
                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                        {actionLoading === app.id + 'approve' ? 'Approving…' : 'Approve'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(app.id, 'reject')}
                                                        disabled={!!actionLoading}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 text-xs font-semibold rounded-lg border border-red-200 transition-colors"
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        {actionLoading === app.id + 'reject' ? 'Rejecting…' : 'Reject'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">
                                                    {app.actioned_at
                                                        ? new Date(app.actioned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                                        : '—'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <button
                                                onClick={() => toggleExpand(app.id)}
                                                className="text-gray-400 hover:text-gray-600 transition-colors"
                                                title={expandedId === app.id ? 'Collapse' : 'View details'}
                                            >
                                                {expandedId === app.id
                                                    ? <ChevronUp className="w-4 h-4" />
                                                    : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Expanded detail row */}
                                    {expandedId === app.id && (
                                        <tr className="bg-gray-50">
                                            <td colSpan={6} className="px-6 py-5">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className="font-semibold text-gray-700 mb-1">Services offered</p>
                                                        <p className="text-gray-600">{app.service_description}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-700 mb-1">Biggest challenge</p>
                                                        <p className="text-gray-600">{app.biggest_challenge}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-700 mb-1">Session management</p>
                                                        <p className="text-gray-600">{app.session_management.join(', ')}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-700 mb-1">Has active clients</p>
                                                        <p className="text-gray-600">{app.has_active_clients ? 'Yes' : 'No'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-700 mb-1">How did you hear about us</p>
                                                        <p className="text-gray-600">{app.referral_source || '—'}</p>
                                                    </div>
                                                    {app.profile_link && (
                                                        <div>
                                                            <p className="font-semibold text-gray-700 mb-1">Profile link</p>
                                                            <a
                                                                href={app.profile_link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-primary-600 hover:underline break-all"
                                                            >
                                                                {app.profile_link}
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default BetaApplicationsPage;
