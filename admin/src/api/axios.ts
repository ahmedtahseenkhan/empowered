import axios from 'axios';

// Use full API URL when admin is on a different host (e.g. admin.emplearnings.com).
// Set VITE_API_URL=https://emplearnings.com/api in admin .env so demo bookings and other API calls reach the backend.
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

// Add a request interceptor to add the auth token to every request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
