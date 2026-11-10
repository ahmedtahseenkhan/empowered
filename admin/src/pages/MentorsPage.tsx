import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Search, ShieldCheck, Mail, Eye, EyeOff, CheckCircle, XCircle, ExternalLink, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { mentorPublicUrl, openExternal } from '../lib/urls';

type VisibilityCheckKey = 'admin_approved' | 'email_verified' | 'not_suspended';

interface Mentor {
    id: string;
    username: string;
    profile_photo: string | null;
    tier: string;
    is_verified: boolean;
    is_publicly_visible: boolean;
    checks: Record<VisibilityCheckKey, boolean>;
    user: {
        id: string;
        email: string;
        is_suspended: boolean;
        is_verified: boolean;
        created_at: string;
    };
}

interface Counts {
    total: number;
    visible: number;
    hidden: number;
    pending_approval: number;
    email_unverified: number;
    suspended: number;
}

type MentorFilter = 'all' | 'visible' | 'hidden' | 'pending_approval' | 'email_unverified' | 'suspended';

const FILTER_OPTIONS: { value: MentorFilter; label: string }[] = [
    { value: 'all', label: 'All mentors' },
    { value: 'visible', label: 'Visible to students' },
    { value: 'hidden', label: 'Hidden from students' },
    { value: 'pending_approval', label: 'Pending admin approval' },
    { value: 'email_unverified', label: 'Email not verified' },
    { value: 'suspended', label: 'Suspended' },
];

// Same three requirements the server applies to the public listing.
const VISIBILITY_CHECKS: { key: VisibilityCheckKey; label: string }[] = [
    { key: 'admin_approved', label: 'Admin approved' },
    { key: 'email_verified', label: 'Email verified' },
    { key: 'not_suspended', label: 'Not suspended' },
];

const MentorsPage: React.FC = () => {
    const navigate = useNavigate();
    const [mentors, setMentors] = useState<Mentor[]>([]);
    const [counts, setCounts] = useState<Counts | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filter, setFilter] = useState<MentorFilter>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [actionLoading, setActionLoading] = useState(false);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchMentors = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/mentors', {
                params: { q: debouncedSearch, filter }
            });
            const rows: Mentor[] = res.data.mentors || [];
            setMentors(rows);
            setCounts(res.data.counts || null);
            // Drop selections that are no longer in the list.
            setSelected(prev => {
                const ids = new Set(rows.map(m => m.id));
                const next = new Set(Array.from(prev).filter(id => ids.has(id)));
                return next.size === prev.size ? prev : next;
            });
        } catch (error) {
            console.error('Failed to fetch mentors', error);
            setNotice({ type: 'error', text: 'Failed to load mentors.' });
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, filter]);

    useEffect(() => {
        fetchMentors();
    }, [fetchMentors]);

    const allSelected = mentors.length > 0 && mentors.every(m => selected.has(m.id));

    const toggleAll = () => {
        setSelected(allSelected ? new Set() : new Set(mentors.map(m => m.id)));
    };

    const toggleOne = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const setApproval = async (ids: string[], is_verified: boolean) => {
        if (ids.length === 0) return;
        const verb = is_verified ? 'Approve' : 'Revoke approval for';
        const consequence = is_verified
            ? 'Approved mentors become visible to students once their email is verified and they are not suspended.'
            : 'They will be hidden from students.';
        if (!confirm(`${verb} ${ids.length} mentor${ids.length === 1 ? '' : 's'}? ${consequence}`)) return;

        setActionLoading(true);
        setNotice(null);
        try {
            const res = await api.put('/admin/mentors/bulk-approved', { ids, is_verified });
            const updated: unknown[] = res.data.updated || [];
            const failed: unknown[] = res.data.failed || [];
            setNotice({
                type: failed.length ? 'error' : 'success',
                text: `${updated.length} mentor${updated.length === 1 ? '' : 's'} ${is_verified ? 'approved' : 'unapproved'}`
                    + (failed.length ? `, ${failed.length} failed.` : '.'),
            });
            setSelected(new Set());
            await fetchMentors();
        } catch (error) {
            console.error('Failed to update approval', error);
            setNotice({ type: 'error', text: 'Failed to update approval status.' });
        } finally {
            setActionLoading(false);
        }
    };

    // Only send ids where the change actually applies, so the summary counts are honest.
    const bulkApprove = () => setApproval(mentors.filter(m => selected.has(m.id) && !m.is_verified).map(m => m.id), true);
    const bulkRevoke = () => setApproval(mentors.filter(m => selected.has(m.id) && m.is_verified).map(m => m.id), false);

    const selectedPending = mentors.filter(m => selected.has(m.id) && !m.is_verified).length;
    const selectedApproved = mentors.filter(m => selected.has(m.id) && m.is_verified).length;

    const summaryChips: { label: string; value: number | undefined; filter: MentorFilter; tone: string }[] = [
        { label: 'All mentors', value: counts?.total, filter: 'all', tone: 'text-gray-900' },
        { label: 'Visible to students', value: counts?.visible, filter: 'visible', tone: 'text-green-700' },
        { label: 'Hidden', value: counts?.hidden, filter: 'hidden', tone: 'text-amber-700' },
        { label: 'Pending approval', value: counts?.pending_approval, filter: 'pending_approval', tone: 'text-blue-700' },
        { label: 'Suspended', value: counts?.suspended, filter: 'suspended', tone: 'text-red-700' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Mentors</h1>
                    <p className="text-gray-600 mt-1">Manage all registered mentors and see exactly who students can find.</p>
                </div>
            </div>

            {/* Platform-wide counts; click one to filter the list. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {summaryChips.map(chip => (
                    <button
                        key={chip.filter}
                        type="button"
                        onClick={() => setFilter(chip.filter)}
                        className={cn(
                            "bg-white rounded-xl border p-4 text-left transition-colors",
                            filter === chip.filter ? "border-primary-500 ring-2 ring-primary-100" : "border-gray-200 hover:border-gray-300"
                        )}
                    >
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{chip.label}</div>
                        <div className={cn("text-2xl font-bold mt-1", chip.tone)}>{chip.value ?? '—'}</div>
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as MentorFilter)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        aria-label="Filter mentors"
                    >
                        {FILTER_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {selected.size > 0 && (
                    <div className="px-4 py-3 border-b border-primary-100 bg-primary-50 flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">
                            {selected.size} selected
                            <span className="text-gray-500 font-normal"> · {selectedPending} pending, {selectedApproved} approved</span>
                        </span>
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                type="button"
                                onClick={bulkApprove}
                                disabled={actionLoading || selectedPending === 0}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ShieldCheck className="w-4 h-4" /> Approve ({selectedPending})
                            </button>
                            <button
                                type="button"
                                onClick={bulkRevoke}
                                disabled={actionLoading || selectedApproved === 0}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-amber-700 border border-amber-200 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <XCircle className="w-4 h-4" /> Revoke approval ({selectedApproved})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelected(new Set())}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-white"
                            >
                                <X className="w-4 h-4" /> Clear
                            </button>
                        </div>
                    </div>
                )}

                {notice && (
                    <div className={cn(
                        "px-4 py-2 text-sm border-b flex items-center justify-between gap-3",
                        notice.type === 'success' ? "bg-green-50 border-green-100 text-green-800" : "bg-red-50 border-red-100 text-red-800"
                    )}>
                        <span>{notice.text}</span>
                        <button type="button" onClick={() => setNotice(null)} className="p-1 rounded hover:bg-white/60" aria-label="Dismiss">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading mentors...</div>
                ) : mentors.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No mentors found.</div>
                ) : (
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="pl-6 pr-2 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleAll}
                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        aria-label="Select all mentors"
                                    />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mentor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visible to students</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {mentors.map((mentor) => (
                                <tr key={mentor.id} className={cn("hover:bg-gray-50 transition-colors", selected.has(mentor.id) && "bg-primary-50/40")}>
                                    <td className="pl-6 pr-2 py-4 w-10">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(mentor.id)}
                                            onChange={() => toggleOne(mentor.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            aria-label={`Select ${mentor.username}`}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                <img
                                                    className="h-10 w-10 rounded-full object-cover"
                                                    src={mentor.profile_photo || `https://ui-avatars.com/api/?name=${mentor.username}&background=random`}
                                                    alt=""
                                                />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                                    {mentor.username}
                                                    {mentor.is_verified && <ShieldCheck className="w-3 h-3 text-blue-500" />}
                                                </div>
                                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Mail className="w-3 h-3" /> {mentor.user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {mentor.user.is_suspended ? (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                Suspended
                                            </span>
                                        ) : (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col gap-1.5">
                                            {mentor.is_publicly_visible ? (
                                                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                                    <Eye className="w-3 h-3" /> Visible
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                                                    <EyeOff className="w-3 h-3" /> Hidden
                                                </span>
                                            )}
                                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                                {VISIBILITY_CHECKS.map(check => {
                                                    const ok = mentor.checks?.[check.key] ?? false;
                                                    return (
                                                        <span
                                                            key={check.key}
                                                            className={cn("inline-flex items-center gap-1 text-[11px]", ok ? "text-green-700" : "text-red-600")}
                                                        >
                                                            {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                            {check.label}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className={cn(
                                            "inline-block px-2 py-0.5 rounded text-xs font-medium border",
                                            mentor.tier === 'PREMIUM' ? "bg-purple-100 text-purple-800 border-purple-200" :
                                                mentor.tier === 'PRO' ? "bg-blue-100 text-blue-800 border-blue-200" :
                                                    "bg-gray-100 text-gray-800 border-gray-200"
                                        )}>
                                            {mentor.tier}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(mentor.user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="inline-flex items-center gap-3">
                                            {!mentor.is_verified && (
                                                <button
                                                    type="button"
                                                    onClick={() => setApproval([mentor.id], true)}
                                                    disabled={actionLoading}
                                                    className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                                >
                                                    Approve
                                                </button>
                                            )}
                                            {mentor.is_publicly_visible && (
                                                <button
                                                    type="button"
                                                    onClick={() => openExternal(mentorPublicUrl(mentor.id))}
                                                    className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                                                    title="Open the public profile students see"
                                                >
                                                    View on site <ExternalLink className="w-3 h-3" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/mentors/${mentor.id}`)}
                                                className="text-primary-600 hover:text-primary-900"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MentorsPage;
