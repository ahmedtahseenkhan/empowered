import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility to merge tailwind classes */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** If true, the image will load eagerly. Only set true for above-the-fold images like hero sections. */
  priority?: boolean;
}

/**
 * A wrapper around the native <img> tag that enforces performance best practices:
 * 1. Default lazy loading (loading="lazy")
 * 2. Non-blocking decoding (decoding="async")
 * 3. Consistent styling capabilities
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className,
  priority = false,
  ...props
}) => {
  return (
    <img
      src={src}
      alt={alt || ''}
      className={cn('object-cover', className)}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      {...props}
    />
  );
};

export default OptimizedImage;
