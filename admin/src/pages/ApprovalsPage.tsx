import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { BadgeCheck, XCircle, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

interface CertificationRequest {
    id: string;
    name: string;
    issuer: string;
    year: number;
    image_url: string | null;
    created_at: string;
    tutor: {
        id: string;
        username: string;
        user?: { email: string };
    };
}

interface ReviewRequest {
    id: string;
    platform: string;
    reviewer: string;
    rating: number;
    comment: string | null;
    proof_url?: string;
    created_at: string;
    tutor: {
        id: string;
        username: string;
        user?: { email: string };
    };
}

const ApprovalsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'certifications' | 'reviews'>('certifications');
    const [certifications, setCertifications] = useState<CertificationRequest[]>([]);
    const [reviews, setReviews] = useState<ReviewRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const [certRes, reviewRes] = await Promise.all([
                api.get('/admin/approvals/certifications?status=PENDING'),
                api.get('/admin/approvals/external-reviews?status=PENDING')
            ]);
            setCertifications(certRes.data.certifications);
            setReviews(reviewRes.data.reviews);
        } catch (error) {
            console.error('Failed to fetch approvals', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleCertificationAction = async (id: string, action: 'approve' | 'reject') => {
        if (!confirm(`Are you sure you want to ${action} this certification?`)) return;

        // If rejecting, ask for reason
        let reason = '';
        if (action === 'reject') {
            const input = prompt('Please provide a reason for rejection:');
            if (input === null) return; // Cancelled
            if (!input.trim()) return alert('Reason is required for rejection');
            reason = input;
        }

        setActionLoading(id);
        try {
            await api.put(`/admin/approvals/certifications/${id}/${action}`, action === 'reject' ? { reason } : {});
            // Remove from list
            setCertifications(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error(`Failed to ${action} certification`, error);
            alert(`Failed to ${action} certification`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReviewAction = async (id: string, action: 'approve' | 'reject') => {
        if (!confirm(`Are you sure you want to ${action} this review?`)) return;

        let reason = '';
        if (action === 'reject') {
            const input = prompt('Please provide a reason for rejection:');
            if (input === null) return;
            if (!input.trim()) return alert('Reason is required for rejection');
            reason = input;
        }

        setActionLoading(id);
        try {
            await api.put(`/admin/approvals/external-reviews/${id}/${action}`, action === 'reject' ? { reason } : {});
            setReviews(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            console.error(`Failed to ${action} review`, error);
            alert(`Failed to ${action} review`);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
                    <p className="text-gray-600 mt-1">Review and verify tutor credentials and external proofs.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('certifications')}
                        className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'certifications' ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}
                    >
                        Certifications ({certifications.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('reviews')}
                        className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'reviews' ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}
                    >
                        External Reviews ({reviews.length})
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading requests...</div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {activeTab === 'certifications' && (
                        certifications.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No pending certification requests.</div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Certification</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proof</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {certifications.map((cert) => (
                                        <tr key={cert.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{cert.tutor.username}</div>
                                                        <div className="text-sm text-gray-500">{cert.tutor.user?.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{cert.name}</div>
                                                <div className="text-xs text-gray-500">{cert.issuer}, {cert.year}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {cert.image_url ? (
                                                    <a href={cert.image_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-sm">
                                                        View Document <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400 text-sm italic">No document</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(cert.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                <button
                                                    onClick={() => handleCertificationAction(cert.id, 'approve')}
                                                    disabled={actionLoading === cert.id}
                                                    className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                                >
                                                    <BadgeCheck className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleCertificationAction(cert.id, 'reject')}
                                                    disabled={actionLoading === cert.id}
                                                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                                >
                                                    <XCircle className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    )}

                    {activeTab === 'reviews' && (
                        reviews.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No pending external review requests.</div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform / Reviewer</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating / Comment</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proof</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {reviews.map((rev) => (
                                        <tr key={rev.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{rev.tutor.username}</div>
                                                        <div className="text-sm text-gray-500">{rev.tutor.user?.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{rev.platform}</div>
                                                <div className="text-xs text-gray-500">By: {rev.reviewer}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center text-yellow-500 mb-1">
                                                    {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                                                </div>
                                                {rev.comment && <div className="text-xs text-gray-600 line-clamp-2 max-w-xs">{rev.comment}</div>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {rev.proof_url ? (
                                                    <a href={rev.proof_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-sm">
                                                        Link <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400 text-sm italic">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                <button
                                                    onClick={() => handleReviewAction(rev.id, 'approve')}
                                                    disabled={actionLoading === rev.id}
                                                    className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                                >
                                                    <BadgeCheck className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleReviewAction(rev.id, 'reject')}
                                                    disabled={actionLoading === rev.id}
                                                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                                >
                                                    <XCircle className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default ApprovalsPage;
