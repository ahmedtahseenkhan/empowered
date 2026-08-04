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

const apiError = (e: unknown): { code?: string; error?: string } =>
    (e as { response?: { data?: { code?: string; error?: string } } })?.response?.data || {};

// Every country Stripe can open a Connect account in — full-service countries plus
// cross-border payout recipients. The server decides which service agreement and
// capabilities apply (see FULL_SERVICE_COUNTRIES in stripeService.ts).
// Source: Stripe Country Specs API (stripe.countrySpecs.list).
const supportedCountries = [
    { code: 'AL', name: 'Albania' },
    { code: 'DZ', name: 'Algeria' },
    { code: 'AO', name: 'Angola' },
    { code: 'AG', name: 'Antigua & Barbuda' },
    { code: 'AR', name: 'Argentina' },
    { code: 'AM', name: 'Armenia' },
    { code: 'AU', name: 'Australia' },
    { code: 'AT', name: 'Austria' },
    { code: 'AZ', name: 'Azerbaijan' },
    { code: 'BS', name: 'Bahamas' },
    { code: 'BH', name: 'Bahrain' },
    { code: 'BD', name: 'Bangladesh' },
    { code: 'BE', name: 'Belgium' },
    { code: 'BJ', name: 'Benin' },
    { code: 'BT', name: 'Bhutan' },
    { code: 'BO', name: 'Bolivia' },
    { code: 'BA', name: 'Bosnia & Herzegovina' },
    { code: 'BW', name: 'Botswana' },
    { code: 'BR', name: 'Brazil' },
    { code: 'BN', name: 'Brunei' },
    { code: 'BG', name: 'Bulgaria' },
    { code: 'KH', name: 'Cambodia' },
    { code: 'CA', name: 'Canada' },
    { code: 'CL', name: 'Chile' },
    { code: 'CO', name: 'Colombia' },
    { code: 'CR', name: 'Costa Rica' },
    { code: 'CI', name: "Côte d'Ivoire" },
    { code: 'HR', name: 'Croatia' },
    { code: 'CY', name: 'Cyprus' },
    { code: 'CZ', name: 'Czech Republic' },
    { code: 'DK', name: 'Denmark' },
    { code: 'DO', name: 'Dominican Republic' },
    { code: 'EC', name: 'Ecuador' },
    { code: 'EG', name: 'Egypt' },
    { code: 'SV', name: 'El Salvador' },
    { code: 'EE', name: 'Estonia' },
    { code: 'ET', name: 'Ethiopia' },
    { code: 'FI', name: 'Finland' },
    { code: 'FR', name: 'France' },
    { code: 'GA', name: 'Gabon' },
    { code: 'GM', name: 'Gambia' },
    { code: 'DE', name: 'Germany' },
    { code: 'GH', name: 'Ghana' },
    { code: 'GI', name: 'Gibraltar' },
    { code: 'GR', name: 'Greece' },
    { code: 'GT', name: 'Guatemala' },
    { code: 'GY', name: 'Guyana' },
    { code: 'HK', name: 'Hong Kong' },
    { code: 'HU', name: 'Hungary' },
    { code: 'IS', name: 'Iceland' },
    { code: 'IN', name: 'India' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'IE', name: 'Ireland' },
    { code: 'IL', name: 'Israel' },
    { code: 'IT', name: 'Italy' },
    { code: 'JM', name: 'Jamaica' },
    { code: 'JP', name: 'Japan' },
    { code: 'JO', name: 'Jordan' },
    { code: 'KZ', name: 'Kazakhstan' },
    { code: 'KE', name: 'Kenya' },
    { code: 'KW', name: 'Kuwait' },
    { code: 'LA', name: 'Laos' },
    { code: 'LV', name: 'Latvia' },
    { code: 'LI', name: 'Liechtenstein' },
    { code: 'LT', name: 'Lithuania' },
    { code: 'LU', name: 'Luxembourg' },
    { code: 'MO', name: 'Macao' },
    { code: 'MG', name: 'Madagascar' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'MT', name: 'Malta' },
    { code: 'MU', name: 'Mauritius' },
    { code: 'MX', name: 'Mexico' },
    { code: 'MD', name: 'Moldova' },
    { code: 'MC', name: 'Monaco' },
    { code: 'MN', name: 'Mongolia' },
    { code: 'MA', name: 'Morocco' },
    { code: 'MZ', name: 'Mozambique' },
    { code: 'NA', name: 'Namibia' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'NE', name: 'Niger' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'MK', name: 'North Macedonia' },
    { code: 'NO', name: 'Norway' },
    { code: 'OM', name: 'Oman' },
    { code: 'PK', name: 'Pakistan' },
    { code: 'PA', name: 'Panama' },
    { code: 'PY', name: 'Paraguay' },
    { code: 'PE', name: 'Peru' },
    { code: 'PH', name: 'Philippines' },
    { code: 'PL', name: 'Poland' },
    { code: 'PT', name: 'Portugal' },
    { code: 'QA', name: 'Qatar' },
    { code: 'RO', name: 'Romania' },
    { code: 'RW', name: 'Rwanda' },
    { code: 'SM', name: 'San Marino' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'SN', name: 'Senegal' },
    { code: 'RS', name: 'Serbia' },
    { code: 'SG', name: 'Singapore' },
    { code: 'SK', name: 'Slovakia' },
    { code: 'SI', name: 'Slovenia' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'KR', name: 'South Korea' },
    { code: 'ES', name: 'Spain' },
    { code: 'LK', name: 'Sri Lanka' },
    { code: 'LC', name: 'St. Lucia' },
    { code: 'SE', name: 'Sweden' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'TW', name: 'Taiwan' },
    { code: 'TZ', name: 'Tanzania' },
    { code: 'TH', name: 'Thailand' },
    { code: 'TT', name: 'Trinidad & Tobago' },
    { code: 'TN', name: 'Tunisia' },
    { code: 'TR', name: 'Türkiye' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'US', name: 'United States' },
    { code: 'UY', name: 'Uruguay' },
    { code: 'UZ', name: 'Uzbekistan' },
    { code: 'VN', name: 'Vietnam' },
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
        } catch (error: unknown) {
            console.error('Failed to create onboarding link:', error);
            alert(apiError(error).error || 'Failed to start onboarding. Please try again.');
        } finally {
            setCreatingLink(false);
        }
    };

    const handleManageOnStripe = async () => {
        try {
            setCreatingLink(true);
            const res = await api.post('/payments/mentor/express-login');
            if (res.data?.url) {
                window.location.href = res.data.url;
            }
        } catch (error: unknown) {
            // If Stripe says onboarding isn't actually complete, fall back to the onboarding flow.
            if (apiError(error).code === 'ONBOARDING_INCOMPLETE') {
                return handleStartOnboarding();
            }
            console.error('Failed to open Stripe dashboard:', error);
            alert(apiError(error).error || 'Failed to open your Stripe dashboard. Please try again.');
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
        } catch (error: unknown) {
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
    // Once details are submitted and nothing is outstanding, send the mentor to their
    // Express dashboard (login link) instead of re-running onboarding.
    const canManageOnStripe = !!status?.detailsSubmitted && !hasPendingRequirements;

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
                            onClick={canManageOnStripe ? handleManageOnStripe : handleStartOnboarding}
                            disabled={creatingLink}
                            className="w-full sm:w-auto flex items-center gap-2"
                        >
                            {creatingLink && <Loader className="w-4 h-4 animate-spin" />}
                            <span>
                                {!status?.hasAccount
                                    ? 'Connect with Stripe'
                                    : canManageOnStripe
                                        ? 'Manage Account on Stripe'
                                        : 'Complete Onboarding'}
                            </span>
                            <ExternalLink className="w-4 h-4" />
                        </Button>

                        <p className="text-sm text-gray-500">
                            {!status?.hasAccount
                                ? "You'll be redirected to Stripe to create and set up your account."
                                : canManageOnStripe
                                    ? "You'll be redirected to your Stripe Express dashboard to view payouts and edit your account details."
                                    : "You'll be redirected to Stripe to finish setting up your account."}
                            {' '}This is a secure process handled by Stripe.
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
