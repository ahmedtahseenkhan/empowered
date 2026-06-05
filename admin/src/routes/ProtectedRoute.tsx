import { useEffect, useState } from 'react';
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
                // Verify token + role and refresh the cached admin user so that
                // is_super_admin / permissions stay current for the sidebar + route guards.
                const res = await api.get('/auth/me');
                const user = res.data.user;
                if (user?.role === 'ADMIN') {
                    localStorage.setItem('adminUser', JSON.stringify(user));
                    setIsAuthenticated(true);
                } else {
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminUser');
                }
            } catch (error) {
                console.error('Auth verification failed', error);
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
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
