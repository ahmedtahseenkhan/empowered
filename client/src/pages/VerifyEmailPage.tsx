import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * Old verification emails linked here with a one-time token. Email verification now uses a
 * 6-digit code, so keep the route alive and forward to the code page.
 */
const VerifyEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const email = (searchParams.get('email') || '').trim();
    const target = email ? `/verify-code?email=${encodeURIComponent(email)}` : '/verify-code';
    return <Navigate to={target} replace />;
};

export default VerifyEmailPage;
