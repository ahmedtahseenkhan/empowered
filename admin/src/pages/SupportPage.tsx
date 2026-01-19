import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Loader2, Search, Filter, MessageCircle, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface Ticket {
    id: string;
    subject: string;
    message: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    created_at: string;
    user_name: string;
    user_email: string;
    user_role: string;
}

const SupportPage: React.FC = () => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchTickets();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [search, selectedStatus]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (search) params.q = search;
            if (selectedStatus) params.status = selectedStatus;

            const response = await api.get('/admin/support', { params });
            setTickets(response.data.tickets);
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReply = async () => {
        if (!selectedTicket || !replyMessage.trim()) return;

        setSendingReply(true);
        try {
            await api.put(`/admin/support/${selectedTicket.id}/reply`, {
                message: replyMessage,
                status: 'RESOLVED',
            });

            // Refresh tickets and close modal
            fetchTickets();
            setSelectedTicket(null);
            setReplyMessage('');
        } catch (error) {
            console.error('Failed to send reply:', error);
        } finally {
            setSendingReply(false);
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'URGENT': return 'bg-red-100 text-red-800';
            case 'HIGH': return 'bg-orange-100 text-orange-800';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'RESOLVED': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'IN_PROGRESS': return <Clock className="w-4 h-4 text-blue-500" />;
            default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Queries & Complaints</h1>
                    <p className="text-gray-500 mt-1">Manage support tickets from mentors and students.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by subject, email, or name..."
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-100">
                    {loading ? (
                        <div className="p-12 text-center text-gray-500">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Loading tickets...
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            No tickets found matching your search.
                        </div>
                    ) : (
                        tickets.map((ticket) => (
                            <div
                                key={ticket.id}
                                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => setSelectedTicket(ticket)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className={cn("px-2 py-0.5 rounded text-xs font-medium", getPriorityColor(ticket.priority))}>
                                                {ticket.priority}
                                            </span>
                                            <h3 className="text-base font-semibold text-gray-900">{ticket.subject}</h3>
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-2">{ticket.message}</p>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                                            <span className="font-medium text-gray-700">{ticket.user_name}</span>
                                            <span>•</span>
                                            <span>{ticket.user_email}</span>
                                            <span>•</span>
                                            <span>{format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                            {getStatusIcon(ticket.status)}
                                            <span>{ticket.status.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Reply Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900">Reply to Ticket</h2>
                            <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-gray-600">
                                &times;
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Original Message */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-gray-900">{selectedTicket.user_name}</span>
                                    <span className="text-xs text-gray-500">{format(new Date(selectedTicket.created_at), 'MMM d, yyyy')}</span>
                                </div>
                                <h3 className="font-medium text-gray-800 mb-2">{selectedTicket.subject}</h3>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedTicket.message}</p>
                            </div>

                            {/* Reply Form */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Response</label>
                                    <textarea
                                        rows={6}
                                        className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        placeholder="Type your response here..."
                                        value={replyMessage}
                                        onChange={(e) => setReplyMessage(e.target.value)}
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Using Template: <strong>Standard Support Reply</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReply}
                                disabled={sendingReply || !replyMessage.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
                            >
                                {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                                Send & Resolve
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupportPage;
