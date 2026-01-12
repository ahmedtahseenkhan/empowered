import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const StudentBookingConfirmationPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const bookingId = searchParams.get('bookingId');

    return (
        <DashboardLayout>
            <div className="w-full">
                <Card className="p-8 text-center w-full">
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">Booking Created</h1>
                    <p className="text-gray-600 mb-6">
                        Your booking has been created successfully. Next: payment setup and confirmation emails.
                    </p>
                    {bookingId && (
                        <div className="text-xs text-gray-500 mb-6">Booking ID: {bookingId}</div>
                    )}
                    <div className="flex gap-3">
                        <Link to="/student/mentors" className="flex-1">
                            <Button variant="outline" className="w-full">Find More Mentors</Button>
                        </Link>
                        <Link to="/dashboard" className="flex-1">
                            <Button className="w-full">Go Home</Button>
                        </Link>
                    </div>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default StudentBookingConfirmationPage;
