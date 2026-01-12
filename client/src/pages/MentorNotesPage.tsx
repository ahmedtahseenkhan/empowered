import React from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';

const MentorNotesPage: React.FC = () => {
    return (
        <DashboardLayout>
            <div className="w-full">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Notes from Mentor</h1>
                <Card className="p-6">
                    <div className="text-sm text-gray-700 font-semibold">Coming soon</div>
                    <div className="text-sm text-gray-600 mt-1">
                        This area can store mentor notes, homework, and follow-up resources per session.
                    </div>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default MentorNotesPage;
