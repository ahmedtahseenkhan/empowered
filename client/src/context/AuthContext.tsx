import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

interface User {
    id: string;
    email: string;
    role: 'STUDENT' | 'TUTOR' | 'ADMIN';
    username: string;
    tier?: string;
    is_beta?: boolean;
    timezone?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (savedToken && savedUser) {
            setToken(savedToken);
            const parsedUser: User = JSON.parse(savedUser);
            setUser(parsedUser);

            // The cached `tier` / `is_beta` are captured at login time and can go stale
            // (e.g. the user upgrades after logging in). Re-fetch the live values
            // for tutors so gated nav items (AI Assist) reflect the current plan.
            if (parsedUser.role === 'TUTOR') {
                api.get('/payments/mentor/status')
                    .then(res => {
                        const freshTier = res.data?.tier ?? null;
                        const freshBeta = typeof res.data?.is_beta === 'boolean' ? res.data.is_beta : undefined;
                        const tierChanged = !!freshTier && freshTier !== parsedUser.tier;
                        const betaChanged = freshBeta !== undefined && freshBeta !== !!parsedUser.is_beta;
                        if (tierChanged || betaChanged) {
                            const updatedUser: User = {
                                ...parsedUser,
                                ...(tierChanged ? { tier: freshTier } : {}),
                                ...(betaChanged ? { is_beta: freshBeta } : {}),
                            };
                            setUser(updatedUser);
                            localStorage.setItem('user', JSON.stringify(updatedUser));
                        }
                    })
                    .catch(() => {});
            }
        }
        setLoading(false);
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
