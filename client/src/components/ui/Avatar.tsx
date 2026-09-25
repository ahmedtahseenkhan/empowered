import React from 'react';
import { cn } from '../../utils/cn';

interface AvatarProps {
    name: string;
    src?: string;
    className?: string;
}

const PALETTE = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500', 'bg-violet-500'];

const initialsOf = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '?';

/** Profile photo, or locally rendered initials (no third-party avatar service). */
export const Avatar: React.FC<AvatarProps> = ({ name, src, className }) => {
    if (src) {
        return <img loading="lazy" decoding="async" src={src} alt={name} className={cn('rounded-full object-cover', className)} />;
    }
    const colour = PALETTE[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PALETTE.length];
    return (
        <div
            role="img"
            aria-label={name}
            className={cn('rounded-full flex items-center justify-center text-white font-bold text-2xl select-none', colour, className)}
        >
            {initialsOf(name)}
        </div>
    );
};
