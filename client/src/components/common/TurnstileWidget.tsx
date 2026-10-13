import React, { useEffect, useRef, useState } from 'react';
import { TURNSTILE_ENABLED, TURNSTILE_SITE_KEY, loadTurnstile } from '../../utils/turnstile';

interface TurnstileWidgetProps {
    /** Called with a fresh token, or null when it expires, errors or is reset. */
    onToken: (token: string | null) => void;
    /** Change this value to clear the token and issue a new challenge (tokens are single-use). */
    resetSignal?: number;
    action?: string;
    className?: string;
}

/** Cloudflare Turnstile challenge; renders nothing when VITE_TURNSTILE_SITE_KEY is not set. */
const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({ onToken, resetSignal = 0, action, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    const lastResetRef = useRef(resetSignal);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        onTokenRef.current = onToken;
    }, [onToken]);

    useEffect(() => {
        if (!TURNSTILE_ENABLED) return;
        let cancelled = false;
        loadTurnstile()
            .then((turnstile) => {
                if (cancelled || !containerRef.current) return;
                widgetIdRef.current = turnstile.render(containerRef.current, {
                    sitekey: TURNSTILE_SITE_KEY,
                    action,
                    theme: 'light',
                    callback: (token) => onTokenRef.current(token),
                    'expired-callback': () => onTokenRef.current(null),
                    'error-callback': () => onTokenRef.current(null),
                    'timeout-callback': () => onTokenRef.current(null),
                });
            })
            .catch(() => {
                if (!cancelled) setLoadError(true);
            });
        return () => {
            cancelled = true;
            if (widgetIdRef.current && window.turnstile) {
                try { window.turnstile.remove(widgetIdRef.current); } catch { /* already removed */ }
            }
            widgetIdRef.current = null;
        };
    }, [action]);

    useEffect(() => {
        if (resetSignal === lastResetRef.current) return;
        lastResetRef.current = resetSignal;
        onTokenRef.current(null);
        if (widgetIdRef.current && window.turnstile) {
            try { window.turnstile.reset(widgetIdRef.current); } catch { /* widget gone */ }
        }
    }, [resetSignal]);

    if (!TURNSTILE_ENABLED) return null;

    return (
        <div className={className}>
            <div ref={containerRef} />
            {loadError && (
                <p className="text-xs text-red-600 mt-1">
                    The security check could not load. Please disable content blockers or refresh the page.
                </p>
            )}
        </div>
    );
};

export default TurnstileWidget;
