import React from 'react';

export const AnnouncementBar: React.FC = () => {
    return (
        <div className="bg-gradient-to-r from-purple-700 to-purple-900 text-white py-3 overflow-hidden">
            <div className="animate-scroll whitespace-nowrap">
                <span className="inline-block px-4">
                    <strong>Special offer</strong> - Enjoy 2 Months FREE – Absolutely Risk-Free, with No Registration Fees and No Subscription Costs. Limited Time Offer!
                </span>
                <span className="inline-block px-4">
                    <strong>Special offer</strong> - Enjoy 2 Months FREE – Absolutely Risk-Free, with No Registration Fees and No Subscription Costs. Limited Time Offer!
                </span>
                <span className="inline-block px-4">
                    <strong>Special offer</strong> - Enjoy 2 Months FREE – Absolutely Risk-Free, with No Registration Fees and No Subscription Costs. Limited Time Offer!
                </span>
            </div>
        </div>
    );
};
