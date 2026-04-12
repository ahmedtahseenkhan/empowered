import React from 'react';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

export const AnnouncementBar: React.FC = () => {
    const message =
        '🎉 Special Offer — Enjoy 2 Months FREE, No Registration Fees, No Subscription Costs. Limited Time!';

    return (
        <div className="bg-primary-900 text-white text-xs font-medium py-2 overflow-hidden select-none">
            <div className="animate-scroll whitespace-nowrap inline-flex items-center">
                {[1, 2, 3].map((i) => (
                    <span key={i} className="inline-flex items-center gap-2 px-8">
                        <Zap className="w-3 h-3 text-accent-400 flex-shrink-0" />
                        {message}
                        <Link
                            to="/beta"
                            className="ml-2 underline underline-offset-2 hover:text-accent-300 transition-colors"
                        >
                            Claim Offer →
                        </Link>
                    </span>
                ))}
            </div>
        </div>
    );
};
