import React from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    helperText,
    className,
    id,
    ...props
}) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
        <div className="w-full">
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-gray-700 mb-2"
                >
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={cn(
                    'w-full px-4 py-3 rounded-lg border transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    error
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 hover:border-gray-400',
                    className
                )}
                {...props}
            />
            {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
            {helperText && !error && (
                <p className="mt-1 text-sm text-gray-500">{helperText}</p>
            )}
        </div>
    );
};
