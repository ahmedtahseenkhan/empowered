import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'glass' | 'compact';
    hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className,
    variant = 'default',
    hover = false,
    ...props
}) => {
    const baseStyles = variant === 'compact' ? 'rounded-xl p-4 border border-gray-200 bg-white' : 'rounded-xl p-6 border border-gray-200 bg-white shadow-sm';

    const variants = {
        default: '',
        glass: 'glass-card rounded-2xl p-6',
        compact: '',
    };

    const hoverStyles = hover ? 'hover-lift cursor-pointer' : '';

    return (
        <div className={cn(baseStyles, variants[variant], hoverStyles, className)} {...props}>
            {children}
        </div>
    );
};
