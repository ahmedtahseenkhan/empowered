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
};

type UpgradeResult = {
    checked: number;
    opened: number;
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
            } else if (r.checked === 0) {
                setUpgradeNote('All upcoming sessions already let people join without approval.');
            } else {
                setUpgradeNote(
                    `${r.opened} session link(s) switched to join-without-approval, ${r.replaced} replaced with a new link (both sides emailed), ${r.stillRestricted} could not be changed.`
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
                Every Google Meet link (demo calls and mentoring sessions) is created from this Google account. Session links are set so mentors and students join without waiting for approval.
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
                            label={`${status.sessions.upcomingOpen} of ${status.sessions.upcomingWithLink} upcoming session link(s) allow joining without approval`}
                            detail={status.sessions.upcomingNeedingUpgrade > 0
                                ? `${status.sessions.upcomingNeedingUpgrade} older link(s) still ask for host approval. Use "Fix upcoming sessions".`
                                : undefined}
                        />
                    </ul>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => void upgrade()}
                            disabled={upgrading || !healthy || status.sessions.upcomingNeedingUpgrade === 0}
                            className="text-sm px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {upgrading ? 'Updating sessions…' : 'Fix upcoming sessions'}
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
