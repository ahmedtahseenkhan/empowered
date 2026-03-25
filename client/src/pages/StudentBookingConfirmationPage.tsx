import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../api/axios';

const StudentBookingConfirmationPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const bookingId = searchParams.get('bookingId');
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [error, setError] = useState('');

    useEffect(() => {
        const run = async () => {
            if (!sessionId) {
                setStatus('success');
                return;
            }
            try {
                await api.post('/payments/student/booking/finalize', { sessionId });
                setStatus('success');
            } catch (e: any) {
                setError(e?.response?.data?.error || 'Payment completed but booking finalization failed.');
                setStatus('error');
            }
        };
        run();
    }, [sessionId]);

    return (
        <DashboardLayout>
            <div className="w-full">
                <Card className="p-8 text-center w-full">
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">
                        {status === 'processing' ? 'Finalizing your booking...' : status === 'success' ? 'Booking Created' : 'Booking Needs Attention'}
                    </h1>
                    <p className="text-gray-600 mb-6">
                        {status === 'processing'
                            ? 'Please wait while we confirm your payment and create your session(s).'
                            : status === 'success'
                                ? 'Your booking has been created successfully.'
                                : error}
                    </p>
                    {bookingId && (
                        <div className="text-xs text-gray-500 mb-6">Booking ID: {bookingId}</div>
                    )}
                    <div className="flex gap-3">
                        <Link to="/student/mentors" className="flex-1">
                            <Button variant="outline" className="w-full">Find More Mentors</Button>
                        </Link>
                        <Link to="/student/sessions" className="flex-1">
                            <Button className="w-full">My Sessions</Button>
                        </Link>
                    </div>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default StudentBookingConfirmationPage;
