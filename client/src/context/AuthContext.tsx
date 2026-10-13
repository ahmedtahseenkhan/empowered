import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
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
    login: (user: User) => void;
    logout: () => Promise<void>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The session itself is an HttpOnly cookie; only the non-secret profile is cached for first paint.
const USER_CACHE_KEY = 'user';

const readCachedUser = (): User | null => {
    try {
        const raw = localStorage.getItem(USER_CACHE_KEY);
        return raw ? (JSON.parse(raw) as User) : null;
    } catch {
        return null;
    }
};

const writeCachedUser = (user: User | null) => {
    try {
        if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
        else localStorage.removeItem(USER_CACHE_KEY);
    } catch {
        /* storage unavailable */
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(readCachedUser);
    const [loading, setLoading] = useState(true);

    const applyUser = useCallback((next: User | null) => {
        setUser(next);
        writeCachedUser(next);
    }, []);

    useEffect(() => {
        let cancelled = false;
        // Tokens used to live in localStorage; drop any leftover from before the cookie migration.
        try { localStorage.removeItem('token'); } catch { /* storage unavailable */ }

        api.get('/auth/me')
            .then((res) => {
                if (cancelled) return;
                const me = res.data?.user as User | undefined;
                if (!me?.id) {
                    applyUser(null);
                    return;
                }
                const restored: User = {
                    id: me.id,
                    email: me.email,
                    role: me.role,
                    username: me.username,
                    tier: me.tier,
                    is_beta: me.is_beta,
                    timezone: me.timezone,
                };
                applyUser(restored);

                // Re-check the live plan for tutors so gated nav items (AI Assist) reflect the
                // current subscription, e.g. right after an upgrade.
                if (restored.role === 'TUTOR') {
                    api.get('/payments/mentor/status')
                        .then((statusRes) => {
                            if (cancelled) return;
                            const freshTier = statusRes.data?.tier ?? null;
                            const freshBeta = typeof statusRes.data?.is_beta === 'boolean' ? statusRes.data.is_beta : undefined;
                            const tierChanged = !!freshTier && freshTier !== restored.tier;
                            const betaChanged = freshBeta !== undefined && freshBeta !== !!restored.is_beta;
                            if (tierChanged || betaChanged) {
                                applyUser({
                                    ...restored,
                                    ...(tierChanged ? { tier: freshTier } : {}),
                                    ...(betaChanged ? { is_beta: freshBeta } : {}),
                                });
                            }
                        })
                        .catch(() => {});
                }
            })
            .catch((err) => {
                if (cancelled) return;
                // Only a definite "not signed in" clears the session; keep the cached user on network errors.
                const status = err?.response?.status;
                if (status === 401 || status === 403) applyUser(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [applyUser]);

    const login = useCallback((newUser: User) => {
        applyUser(newUser);
    }, [applyUser]);

    const logout = useCallback(async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            /* clear local state regardless */
        }
        applyUser(null);
    }, [applyUser]);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
