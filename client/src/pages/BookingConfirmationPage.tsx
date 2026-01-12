import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageLayout } from '../layouts/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const BookingConfirmationPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const bookingId = searchParams.get('bookingId');

    return (
        <PageLayout>
            <section className="section-container">
                <div className="max-w-xl mx-auto">
                    <Card className="p-8 text-center">
                        <h1 className="heading-lg mb-3">Booking Created</h1>
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
            </section>
        </PageLayout>
    );
};

export default BookingConfirmationPage;
