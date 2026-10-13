import axios from 'axios';
import { API_BASE_URL } from '../lib/urls';

// Use full API URL when admin is on a different host (e.g. admin.emplearnings.com).
// Set VITE_API_URL=https://emplearnings.com/api in admin .env so demo bookings and other API calls reach the backend.
// Auth lives in an HttpOnly cookie set by the API; X-App-Client tells the server to use the admin cookie.
const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: { 'X-App-Client': 'admin' },
});

// Tokens used to be kept in localStorage; drop any left over from old sessions.
try {
    localStorage.removeItem('adminToken');
} catch {
    // storage unavailable — nothing to clean up
}

export const clearCachedAdminUser = () => {
    try {
        localStorage.removeItem('adminUser');
    } catch {
        // ignore
    }
};

// Session expired or revoked: clear the cached profile and send the admin to the login page.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const url = String(error?.config?.url || '');
        // Login/logout errors are shown in place; ProtectedRoute handles /auth/me itself.
        const isAuthCall = /\/auth\/(login|logout|me)\b/.test(url);
        if (status === 401 && !isAuthCall) {
            clearCachedAdminUser();
            if (window.location.pathname !== '/login') {
                window.location.assign('/login');
            }
        }
        return Promise.reject(error);
    }
);

export default api;
