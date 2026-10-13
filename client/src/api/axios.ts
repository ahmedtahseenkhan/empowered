import axios from 'axios';
import { safeRedirectPath } from '../utils/safeRedirect';

// The session lives in an HttpOnly cookie set by the API, so every request must carry credentials.
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    withCredentials: true,
});

const PUBLIC_AUTH_PATHS = ['/login', '/register', '/verify-code', '/verify-email', '/forgot-password', '/reset-password'];

// Session expired / revoked: clear the cached user and send them to sign in again.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            const requestUrl: string = error?.config?.url || '';
            const errorMsg: string = String(error?.response?.data?.error || '');
            // Wrong password on /auth/login and the /auth/me probe are expected 401s, not expired sessions.
            const isAuthProbe = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/me') || requestUrl.includes('/auth/logout');
            const isSessionFailure = /expired|invalid|access token/i.test(errorMsg) && !/credentials/i.test(errorMsg);
            if (!isAuthProbe && isSessionFailure) {
                try { localStorage.removeItem('user'); } catch { /* storage unavailable */ }
                const current = window.location.pathname;
                if (!PUBLIC_AUTH_PATHS.includes(current)) {
                    const back = safeRedirectPath(`${current}${window.location.search}`, '/dashboard');
                    window.location.href = `/login?redirect=${encodeURIComponent(back)}`;
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
