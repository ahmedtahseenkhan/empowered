import React from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';

const PaymentsPage: React.FC = () => {
    return (
        <DashboardLayout>
            <div className="w-full">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Payments</h1>
                <Card className="p-6">
                    <div className="text-sm text-gray-700 font-semibold">Coming soon</div>
                    <div className="text-sm text-gray-600 mt-1">We’ll show payout history and payment settings here.</div>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default PaymentsPage;
