import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Video, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import api from '../../api/axios';

type Status = {
    connected: boolean;
    needs_reconnect: boolean;
    google_email: string | null;
    last_error: string | null;
    connected_at: string | null;
    upcoming_sessions: { on_your_google: number; on_platform_link: number };
};

const apiError = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

const REASONS: Record<string, string> = {
    denied: 'You cancelled the Google sign-in.',
    missing_permission: 'The calendar permission was not ticked on the Google screen. Please connect again and allow all permissions.',
    no_refresh_token: 'Google did not grant offline access. Please connect again.',
    expired: 'The connection request expired. Please try again.',
    invalid_state: 'The connection request was not recognised. Please try again.',
};

/**
 * Mentor card: connect the mentor's own Google account so their sessions are hosted on it.
 * The mentor becomes the meeting host, the student is invited, and Meet no longer shows
 * "This call is open to anyone".
 */
const GoogleMeetConnectCard: React.FC<{ compact?: boolean }> = ({ compact }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [status, setStatus] = useState<Status | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);

    const load = useCallback(() => {
        api.get('/google-calendar/status')
            .then((r) => setStatus(r.data as Status))
            .catch(() => setStatus(null));
    }, []);

    useEffect(() => { load(); }, [load]);

    // Result of the Google redirect: /dashboard?googleCalendar=connected|error&reason=...
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const result = params.get('googleCalendar');
        if (!result) return;
        if (result === 'connected') {
            setNotice('Google connected. New sessions will be created on your Google Calendar with you as the meeting host. Your upcoming sessions are being moved over, and students get the new link by email.');
            window.setTimeout(load, 4000);
        } else {
            const reason = params.get('reason') || '';
            setError(REASONS[reason] || 'Google could not be connected. Please try again.');
        }
        params.delete('googleCalendar');
        params.delete('reason');
        const rest = params.toString();
        navigate(`${location.pathname}${rest ? `?${rest}` : ''}`, { replace: true });
    }, [location.search, location.pathname, navigate, load]);

    const connect = async () => {
        try {
            setBusy(true);
            setError('');
            const res = await api.get('/google-calendar/connect');
            const url = res.data?.authUrl as string | undefined;
            if (url) window.location.href = url;
            else setError('Could not start the Google connection.');
        } catch (e) {
            setError(apiError(e, 'Could not start the Google connection.'));
        } finally {
            setBusy(false);
        }
    };

    const disconnect = async () => {
        try {
            setBusy(true);
            await api.post('/google-calendar/disconnect');
            setConfirmDisconnect(false);
            setNotice('Google disconnected. Sessions already on your Google Calendar keep their links. New sessions use an EmpowerEd link.');
            load();
        } catch (e) {
            setError(apiError(e, 'Could not disconnect Google.'));
        } finally {
            setBusy(false);
        }
    };

    if (!status && !error && !notice) return null;

    const connected = !!status?.connected;
    const broken = !!status?.needs_reconnect;
    const pending = status?.upcoming_sessions.on_platform_link || 0;

    return (
        <div className={`rounded-2xl border p-4 sm:p-5 ${connected ? 'border-green-200 bg-green-50' : broken ? 'border-red-200 bg-red-50' : 'border-purple-200 bg-purple-50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${connected ? 'bg-green-100' : broken ? 'bg-red-100' : 'bg-purple-100'}`}>
                        {connected ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                            : broken ? <AlertTriangle className="w-5 h-5 text-red-600" />
                                : <Video className="w-5 h-5 text-purple-700" />}
                    </div>
                    <div className="min-w-0">
                        {connected ? (
                            <>
                                <h3 className="text-sm font-bold text-green-900">Your sessions are hosted on your Google account</h3>
                                <p className="text-xs text-green-800 mt-1 leading-relaxed">
                                    Connected as <span className="font-semibold">{status?.google_email || 'your Google account'}</span>.
                                    Join your sessions signed in with this account: you are the host and can let your student in if they are asked to wait.
                                    {!compact && pending > 0 && ` ${pending} upcoming session(s) still use an EmpowerEd link and are being moved over.`}
                                </p>
                            </>
                        ) : broken ? (
                            <>
                                <h3 className="text-sm font-bold text-red-900">Reconnect your Google account</h3>
                                <p className="text-xs text-red-800 mt-1 leading-relaxed">
                                    Google stopped accepting the connection{status?.google_email ? ` for ${status.google_email}` : ''}, so new sessions use an EmpowerEd link for now. Reconnect to host them on your Google account again.
                                </p>
                            </>
                        ) : (
                            <>
                                <h3 className="text-sm font-bold text-purple-900">Connect Google to host your sessions</h3>
                                <p className="text-xs text-purple-800 mt-1 leading-relaxed">
                                    Your sessions will be created on your Google Calendar with a private Google Meet link. Your student is invited automatically,
                                    and you let in anyone else who asks to join. One-time setup, about a minute.
                                </p>
                            </>
                        )}
                        {notice && <p className="text-xs text-green-900 bg-white/70 border border-green-200 rounded-lg px-3 py-2 mt-2">{notice}</p>}
                        {error && <p className="text-xs text-red-800 bg-white/70 border border-red-200 rounded-lg px-3 py-2 mt-2">{error}</p>}
                    </div>
                </div>
                <div className="shrink-0 self-start sm:self-auto">
                    {connected ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmDisconnect(true)}>Disconnect</Button>
                    ) : (
                        <Button size="sm" disabled={busy} onClick={connect}>
                            <Video className="w-3.5 h-3.5 mr-1.5" />
                            {busy ? 'Opening Google…' : broken ? 'Reconnect Google' : 'Connect Google'}
                        </Button>
                    )}
                </div>
            </div>

            <Modal isOpen={confirmDisconnect} onClose={() => { if (!busy) setConfirmDisconnect(false); }} title="Disconnect Google?">
                <div className="space-y-4">
                    <p className="text-sm text-gray-700">
                        New sessions will get an EmpowerEd link, where Google shows "This call is open to anyone". Sessions already on your Google Calendar keep their current links.
                    </p>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setConfirmDisconnect(false)}>Keep connected</Button>
                        <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={busy} onClick={disconnect}>
                            {busy ? 'Disconnecting…' : 'Disconnect'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default GoogleMeetConnectCard;
