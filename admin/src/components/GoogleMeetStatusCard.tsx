import React, { useCallback, useEffect, useState } from 'react';
import { Video, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import api from '../api/axios';

type MeetStatus = {
    checkedAt: string;
    tokenConfigured: boolean;
    tokenValid: boolean;
    account: string | null;
    grantedScopes: string[];
    missingMeetScopes: string[];
    meetApiWorking: boolean;
    openAccessApplied: boolean;
    probeAccessType: string | null;
    error: string | null;
    sessions: {
        upcomingWithLink: number;
        upcomingOpen: number;
        upcomingNeedingUpgrade: number;
        upcomingWithoutLink: number;
    };
    sessionsVerifiedLive?: boolean;
    sessionChecks?: Array<{
        kind?: 'session' | 'demo';
        lessonId: string;
        startTime: string;
        mentor: string | null;
        student: string | null;
        link: string;
        recordedAccess: string | null;
        liveAccess: string | null;
        error: string | null;
    }>;
};

type UpgradeResult = {
    checked: number;
    opened: number;
    alreadyOpen?: number;
    replaced: number;
    stillRestricted: number;
    setupError: string | null;
};

const apiError = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

const Row: React.FC<{ state: 'ok' | 'warn' | 'bad'; label: string; detail?: string }> = ({ state, label, detail }) => (
    <li className="flex items-start gap-2 text-sm">
        {state === 'ok' && <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />}
        {state === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
        {state === 'bad' && <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
        <span className="text-gray-800">
            {label}
            {detail ? <span className="block text-xs text-gray-500 break-words">{detail}</span> : null}
        </span>
    </li>
);

/**
 * Live status of the Google account that generates every Meet link (demo calls and
 * sessions), with the actions an admin needs when sessions still ask for host approval.
 */
const GoogleMeetStatusCard: React.FC = () => {
    const [status, setStatus] = useState<MeetStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [upgrading, setUpgrading] = useState(false);
    const [upgradeNote, setUpgradeNote] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/admin/google-meet/status');
            setStatus(res.data as MeetStatus);
        } catch (e) {
            setError(apiError(e, 'Could not check the Google Meet connection.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const upgrade = async () => {
        setUpgrading(true);
        setUpgradeNote('');
        setError('');
        try {
            const res = await api.post('/admin/google-meet/upgrade-sessions');
            const r = res.data as UpgradeResult;
            if (r.setupError) {
                setError(`Sessions could not be updated: ${r.setupError}`);
            } else if (r.opened === 0 && r.replaced === 0 && r.stillRestricted === 0) {
                setUpgradeNote('Checked with Google: all upcoming sessions and demo calls already let people join without approval.');
            } else {
                setUpgradeNote(
                    `${r.opened} link(s) switched to join-without-approval, ${r.replaced} replaced with a new link (both sides emailed), ${r.stillRestricted} could not be changed.`
                );
            }
            await load();
        } catch (e) {
            setError(apiError(e, 'Could not update the session links.'));
        } finally {
            setUpgrading(false);
        }
    };

    const reconnectUrl = `${String(api.defaults.baseURL || '').replace(/\/+$/, '')}/demo/oauth-start`;
    const healthy = !!status && status.tokenValid && status.meetApiWorking && status.openAccessApplied;

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Google Meet connection</h2>
                    {status && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${healthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {healthy ? 'Working' : 'Needs attention'}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => void load()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Checking…' : 'Check again'}
                </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
                Every Google Meet link (demo calls and mentoring sessions) is created from this Google account, and set so everyone with the link joins without waiting for approval.
            </p>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 break-words">{error}</div>}
            {upgradeNote && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{upgradeNote}</div>}

            {status && (
                <>
                    <ul className="space-y-2 mb-4">
                        <Row
                            state={status.tokenValid ? 'ok' : 'bad'}
                            label={status.tokenValid ? 'Google account is connected' : 'Google account is NOT connected'}
                            detail={status.tokenValid
                                ? (status.account ? `Signed in as ${status.account}` : undefined)
                                : 'The saved token is missing, expired or revoked. Reconnect the Google account below.'}
                        />
                        <Row
                            state={status.missingMeetScopes.length === 0 && status.tokenValid ? 'ok' : 'bad'}
                            label={status.missingMeetScopes.length === 0 && status.tokenValid ? 'Google Meet permission granted' : 'Google Meet permission is missing'}
                            detail={status.missingMeetScopes.length > 0 && status.tokenValid
                                ? 'Reconnect the Google account and tick every permission on the consent screen.'
                                : undefined}
                        />
                        <Row
                            state={status.meetApiWorking ? 'ok' : 'bad'}
                            label={status.meetApiWorking ? 'Google Meet API is working' : 'Google Meet API is not working'}
                            detail={!status.meetApiWorking ? status.error || undefined : undefined}
                        />
                        <Row
                            state={status.openAccessApplied ? 'ok' : 'bad'}
                            label={status.openAccessApplied
                                ? 'New meetings let people join without approval'
                                : 'New meetings still require host approval'}
                            detail={!status.openAccessApplied && status.meetApiWorking
                                ? `Google applied access type ${status.probeAccessType || 'unknown'} to a test meeting.`
                                : undefined}
                        />
                        <Row
                            state={status.sessions.upcomingNeedingUpgrade === 0 ? 'ok' : 'warn'}
                            label={`${status.sessions.upcomingOpen} of ${status.sessions.upcomingWithLink} upcoming meeting link(s) (sessions and demo calls) allow joining without approval`}
                            detail={status.sessions.upcomingNeedingUpgrade > 0
                                ? `${status.sessions.upcomingNeedingUpgrade} link(s) still ask for host approval. Use "Check & fix upcoming sessions".`
                                : status.sessionsVerifiedLive ? 'Confirmed with Google just now.' : 'From our records (not confirmed with Google).'}
                        />
                    </ul>

                    {status.sessionChecks && status.sessionChecks.length > 0 && (
                        <div className="overflow-x-auto mb-4 border border-gray-200 rounded-lg">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2">Meeting</th>
                                        <th className="px-3 py-2">Starts</th>
                                        <th className="px-3 py-2">Meet link</th>
                                        <th className="px-3 py-2">Google says</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {status.sessionChecks.map((c) => (
                                        <tr key={`${c.kind || 'session'}-${c.lessonId}`}>
                                            <td className="px-3 py-2 text-gray-800">
                                                {c.kind === 'demo'
                                                    ? `Demo call: ${c.mentor || 'Prospect'}`
                                                    : `Session: ${c.mentor || 'Mentor'} with ${c.student || 'Student'}`}
                                            </td>
                                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(c.startTime).toLocaleString()}</td>
                                            <td className="px-3 py-2">
                                                <a href={c.link} target="_blank" rel="noreferrer" className="text-purple-700 hover:underline break-all">{c.link.replace(/^https?:\/\//, '')}</a>
                                            </td>
                                            <td className="px-3 py-2">
                                                {c.liveAccess === 'OPEN' ? (
                                                    <span className="text-green-700 font-medium">Open, no approval</span>
                                                ) : c.liveAccess ? (
                                                    <span className="text-red-700 font-medium">{c.liveAccess}, approval needed</span>
                                                ) : (
                                                    <span className="text-amber-700">{c.error || 'Could not check'}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => void upgrade()}
                            disabled={upgrading || !healthy || status.sessions.upcomingWithLink === 0}
                            className="text-sm px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {upgrading ? 'Checking sessions…' : 'Check & fix upcoming sessions'}
                        </button>
                        <a
                            href={reconnectUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                        >
                            Reconnect Google account
                        </a>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                        After reconnecting, save the new token as GOOGLE_DEMO_REFRESH_TOKEN on the server and restart it. Last checked {new Date(status.checkedAt).toLocaleString()}.
                    </p>
                </>
            )}
        </div>
    );
};

export default GoogleMeetStatusCard;
