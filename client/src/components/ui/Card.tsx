import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'glass';
    hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className,
    variant = 'default',
    hover = false,
    ...props
}) => {
    const baseStyles = 'rounded-2xl p-6';

    const variants = {
        default: 'bg-white shadow-lg border border-gray-100',
        glass: 'glass-card',
    };

    const hoverStyles = hover ? 'hover-lift cursor-pointer' : '';

    return (
        <div className={cn(baseStyles, variants[variant], hoverStyles, className)} {...props}>
            {children}
        </div>
    );
};
