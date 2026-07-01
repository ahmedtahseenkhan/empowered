import React from 'react';
import { Star } from 'lucide-react';

interface Props {
    rating?: number | null;
    reviewCount?: number | null;
    /** Tailwind size class for each star, e.g. "w-4 h-4" (default). */
    starClassName?: string;
    className?: string;
}

/** Compact review-star display used on mentor cards and headers. */
export const StarRating: React.FC<Props> = ({ rating, reviewCount, starClassName = 'w-4 h-4', className }) => {
    const value = rating || 0;
    const rounded = Math.round(value);

    return (
        <div className={`flex items-center gap-1.5 ${className || ''}`}>
            <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                        key={i}
                        className={`${starClassName} ${i <= rounded ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                    />
                ))}
            </div>
            <span className="text-xs text-gray-500">
                {reviewCount
                    ? `${value.toFixed(1)} (${reviewCount} review${reviewCount === 1 ? '' : 's'})`
                    : 'No reviews yet'}
            </span>
        </div>
    );
};

export default StarRating;
