/** Cloudflare Turnstile site key; the widget (and the "wait for a token" rule) is off when it is unset. */
export const TURNSTILE_SITE_KEY: string = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || '';
export const TURNSTILE_ENABLED = TURNSTILE_SITE_KEY.length > 0;

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export interface TurnstileRenderOptions {
    sitekey: string;
    action?: string;
    theme?: 'light' | 'dark' | 'auto';
    callback?: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: () => void;
    'timeout-callback'?: () => void;
}

export interface TurnstileApi {
    render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
    reset: (widgetId?: string) => void;
    remove: (widgetId?: string) => void;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

let loader: Promise<TurnstileApi> | null = null;

/** Loads the Turnstile script once per page. */
export const loadTurnstile = (): Promise<TurnstileApi> => {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (loader) return loader;
    loader = new Promise<TurnstileApi>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT_SRC;
        script.async = true;
        script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable')));
        script.onerror = () => {
            loader = null;
            script.remove();
            reject(new Error('Failed to load Turnstile'));
        };
        document.head.appendChild(script);
    });
    return loader;
};

/** True when the API rejected a request because the Turnstile check failed. */
export const isCaptchaError = (err: unknown): boolean =>
    (err as { response?: { data?: { code?: string } } })?.response?.data?.code === 'CAPTCHA_FAILED';
