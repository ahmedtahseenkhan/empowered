import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CheckCircle, AlertCircle, ExternalLink, Loader } from 'lucide-react';
import api from '../api/axios';

interface ConnectAccountStatus {
    hasAccount: boolean;
    accountId?: string;
    detailsSubmitted?: boolean;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    requirements?: {
        currentlyDue: string[];
        eventuallyDue: string[];
        pastDue: string[];
    };
}

const supportedCountries = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'IN', name: 'India' },
    { code: 'OM', name: 'Oman' },
    { code: 'AE', name: 'United Arab Emirates' },
    // Add more as needed
];

const ConnectAccountPage: React.FC = () => {
    const [status, setStatus] = useState<ConnectAccountStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [creatingLink, setCreatingLink] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('US');

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const res = await api.get('/payments/mentor/connect-status');
            setStatus(res.data);
        } catch (error) {
            console.error('Failed to fetch Connect account status:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartOnboarding = async () => {
        try {
            setCreatingLink(true);
            const res = await api.post('/payments/mentor/onboard', {
                refreshUrl: window.location.href,
                returnUrl: window.location.href,
                country: selectedCountry,
            });

            if (res.data?.url) {
                window.location.href = res.data.url;
            }
        } catch (error: any) {
            console.error('Failed to create onboarding link:', error);
            alert(error.response?.data?.error || 'Failed to start onboarding. Please try again.');
        } finally {
            setCreatingLink(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect? This will allow you to restart the setup process.')) return;

        try {
            setLoading(true);
            await api.delete('/payments/mentor/connect-account');
            // Refresh status to show the "Connect" button and country selector again
            await fetchStatus();
            setSelectedCountry('US'); // Reset selection
        } catch (error: any) {
            console.error('Failed to disconnect:', error);
            alert('Failed to disconnect account.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader className="w-8 h-8 animate-spin text-primary-600" />
                </div>
            </DashboardLayout>
        );
    }

    const isFullyOnboarded = status?.detailsSubmitted && status?.chargesEnabled && status?.payoutsEnabled;
    const hasPendingRequirements = (status?.requirements?.currentlyDue?.length || 0) > 0 || (status?.requirements?.pastDue?.length || 0) > 0;

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Connect Account Settings</h1>
                    <p className="text-gray-600 mt-2">
                        Set up your Stripe Connect account to receive payments from students
                    </p>
                </div>

                {/* Account Status Card */}
                <Card className="p-8 mb-6">
                    <div className="flex items-start gap-4">
                        {isFullyOnboarded ? (
                            <>
                                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-bold text-gray-900">Account Active</h2>
                                    <p className="text-gray-600 mt-1">
                                        Your Stripe Connect account is fully set up and you can receive payments.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                                    <AlertCircle className="w-6 h-6 text-yellow-600" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-bold text-gray-900">
                                        {status?.hasAccount ? 'Complete Your Setup' : 'Get Started'}
                                    </h2>
                                    <p className="text-gray-600 mt-1">
                                        {status?.hasAccount
                                            ? 'Your account needs additional information to start receiving payments.'
                                            : 'Connect your account with Stripe to receive payments from lesson bookings.'}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </Card>

                {/* Account Details */}
                {status?.hasAccount && (
                    <Card className="p-8 mb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">Account Status</h3>
                        <div className="space-y-4">
                            <StatusRow
                                label="Account Created"
                                status={status.hasAccount}
                            />
                            <StatusRow
                                label="Details Submitted"
                                status={status.detailsSubmitted || false}
                            />
                            <StatusRow
                                label="Charges Enabled"
                                status={status.chargesEnabled || false}
                                description="Ability to receive payments"
                            />
                            <StatusRow
                                label="Payouts Enabled"
                                status={status.payoutsEnabled || false}
                                description="Ability to transfer funds to your bank"
                            />
                        </div>

                        {hasPendingRequirements && (
                            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-semibold text-yellow-900">Action Required</h4>
                                        <p className="text-sm text-yellow-800 mt-1">
                                            {status.requirements?.pastDue && status.requirements.pastDue.length > 0
                                                ? 'There are overdue requirements that need your immediate attention.'
                                                : 'Please complete the following requirements to activate your account.'}
                                        </p>
                                        {status.requirements && (
                                            <ul className="mt-2 text-sm text-yellow-800 list-disc list-inside">
                                                {status.requirements.pastDue?.map((req, i) => (
                                                    <li key={i} className="capitalize">{req.replace(/_/g, ' ')}</li>
                                                ))}
                                                {status.requirements.currentlyDue?.map((req, i) => (
                                                    <li key={i} className="capitalize">{req.replace(/_/g, ' ')}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                )}

                {/* Actions */}
                <Card className="p-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Manage Your Account</h3>
                    <div className="space-y-4">
                        {!status?.hasAccount && (
                            <div className="mb-4">
                                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                                    Country of Residence / Business
                                </label>
                                <select
                                    id="country"
                                    value={selectedCountry}
                                    onChange={(e) => setSelectedCountry(e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                >
                                    {supportedCountries.map((country) => (
                                        <option key={country.code} value={country.code}>
                                            {country.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Select the country where your bank account is located.
                                </p>
                            </div>
                        )}
                        <Button
                            onClick={handleStartOnboarding}
                            disabled={creatingLink}
                            className="w-full sm:w-auto flex items-center gap-2"
                        >
                            {creatingLink && <Loader className="w-4 h-4 animate-spin" />}
                            <span>
                                {status?.hasAccount
                                    ? isFullyOnboarded
                                        ? 'Update Account Details'
                                        : 'Complete Onboarding'
                                    : 'Connect with Stripe'}
                            </span>
                            <ExternalLink className="w-4 h-4" />
                        </Button>

                        <p className="text-sm text-gray-500">
                            You'll be redirected to Stripe to {status?.hasAccount ? 'manage your account' : 'create and set up your account'}.
                            This is a secure process handled by Stripe.
                        </p>

                        {status?.hasAccount && !isFullyOnboarded && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-sm text-gray-600">
                                    Need to change country or restart?
                                    <button
                                        onClick={handleDisconnect}
                                        className="ml-1 text-red-600 hover:text-red-700 font-medium hover:underline"
                                    >
                                        Disconnect and Start Over
                                    </button>
                                </p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Information Card */}
                <Card className="p-6 mt-6 bg-blue-50 border-blue-200">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-900">Why do I need a Connect account?</h4>
                            <p className="text-sm text-blue-800 mt-1">
                                Stripe Connect allows you to receive payments directly from students who book lessons with you.
                                The platform handles all payment processing securely, and funds are transferred to your bank account
                                according to your payout schedule.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </DashboardLayout>
    );
};

const StatusRow: React.FC<{ label: string; status: boolean; description?: string }> = ({ label, status, description }) => (
    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
        <div>
            <div className="font-medium text-gray-900">{label}</div>
            {description && <div className="text-sm text-gray-500 mt-0.5">{description}</div>}
        </div>
        <div className="flex items-center gap-2">
            {status ? (
                <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">Complete</span>
                </>
            ) : (
                <>
                    <AlertCircle className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-500">Pending</span>
                </>
            )}
        </div>
    </div>
);

export default ConnectAccountPage;
