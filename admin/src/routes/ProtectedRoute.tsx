import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import api from '../api/axios';

const ProtectedRoute = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const verifyAuth = async () => {
            const token = localStorage.getItem('adminToken');
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                // Verify token and role with backend
                await api.get('/auth/me');
                // Ideally, backend check ensures role is ADMIN if using requireAdmin middleware on /auth/me or a separate /admin/me endpoint.
                // Since we use the generic /auth/me, we should verify the role in the response if possible, 
                // but if /auth/me doesn't force admin, we might need to check role here.
                // However, the backend /auth/me returns { user: { role: ... } }.

                const res = await api.get('/auth/me');
                if (res.data.user.role === 'ADMIN') {
                    setIsAuthenticated(true);
                }
            } catch (error) {
                console.error('Auth verification failed', error);
                localStorage.removeItem('adminToken');
            } finally {
                setIsLoading(false);
            }
        };

        verifyAuth();
    }, []);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
