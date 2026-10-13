import { useCallback, useState } from 'react';
import { TURNSTILE_ENABLED } from '../utils/turnstile';

/**
 * State for the honeypot + Turnstile pair used on public forms. Spread `fields` into the
 * request body, gate submit on `ready`, and call `reset()` after every submit (tokens are single-use).
 */
export const useBotProtection = () => {
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [honeypot, setHoneypot] = useState('');
    const [resetSignal, setResetSignal] = useState(0);

    const reset = useCallback(() => {
        setTurnstileToken(null);
        setResetSignal((n) => n + 1);
    }, []);

    return {
        turnstileToken,
        setTurnstileToken,
        honeypot,
        setHoneypot,
        resetSignal,
        reset,
        ready: !TURNSTILE_ENABLED || !!turnstileToken,
        fields: { company_website: honeypot, ...(turnstileToken ? { turnstileToken } : {}) },
    };
};

export type BotProtection = ReturnType<typeof useBotProtection>;
