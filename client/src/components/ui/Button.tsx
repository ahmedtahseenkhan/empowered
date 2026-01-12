import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
    as?: typeof Link;
    to?: string;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    className,
    children,
    as,
    to,
    ...props
}) => {
    const baseStyles = 'font-semibold rounded-full transition-all duration-300 ease-in-out inline-flex items-center justify-center';

    const variants = {
        primary: 'bg-gradient-primary text-white hover:scale-105 hover:shadow-lg',
        secondary: 'bg-white text-primary-900 border-2 border-primary-900 hover:bg-primary-50',
        outline: 'bg-transparent text-primary-900 border-2 border-primary-900 hover:bg-primary-900 hover:text-white',
        ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    };

    const sizes = {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
    };

    const classes = cn(baseStyles, variants[variant], sizes[size], className);

    if (as === Link && to) {
        return (
            <Link to={to} className={classes}>
                {children}
            </Link>
        );
    }

    return (
        <button
            className={classes}
            {...props}
        >
            {children}
        </button>
    );
};
