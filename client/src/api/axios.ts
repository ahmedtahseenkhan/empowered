import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Auto-logout when the server returns 401 (expired / invalid token)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            const errorMsg: string = error?.response?.data?.error || '';
            // Only clear session for auth failures, not for things like "User not found"
            if (
                errorMsg.includes('expired') ||
                errorMsg.includes('Invalid') ||
                errorMsg.includes('Access token')
            ) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                // Redirect to login, preserving the current path so the user can return after re-auth
                const current = window.location.pathname;
                if (current !== '/login' && current !== '/register') {
                    window.location.href = `/login?redirect=${encodeURIComponent(current)}`;
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
