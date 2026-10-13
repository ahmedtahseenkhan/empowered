import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import api, { clearCachedAdminUser } from '../api/axios';

const ProtectedRoute = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const verifyAuth = async () => {
            try {
                // The session is an HttpOnly cookie: /auth/me verifies it and the role, and refreshes the
                // cached admin user so is_super_admin / permissions stay current for the sidebar + route guards.
                const res = await api.get('/auth/me');
                const user = res.data.user;
                if (user?.role === 'ADMIN') {
                    localStorage.setItem('adminUser', JSON.stringify(user));
                    setIsAuthenticated(true);
                } else {
                    clearCachedAdminUser();
                }
            } catch {
                clearCachedAdminUser();
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
