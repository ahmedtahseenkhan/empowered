import { useEffect } from 'react';

const isLikelyAboveFold = (img: HTMLImageElement): boolean => {
  const rect = img.getBoundingClientRect();
  return rect.top < window.innerHeight * 1.1 && rect.bottom > 0;
};

const optimizeImageElement = (img: HTMLImageElement) => {
  if (img.dataset.imageOptimized === 'true' || img.dataset.noImageOptimize === 'true') {
    return;
  }

  if (!img.hasAttribute('decoding')) {
    img.decoding = 'async';
  }

  if (!img.hasAttribute('loading')) {
    img.loading = isLikelyAboveFold(img) ? 'eager' : 'lazy';
  }

  if (!img.hasAttribute('fetchpriority')) {
    img.fetchPriority = isLikelyAboveFold(img) ? 'high' : 'low';
  }

  img.dataset.imageOptimized = 'true';
};

export const useImageOptimization = () => {
  useEffect(() => {
    const existingImages = document.querySelectorAll('img');
    existingImages.forEach((img) => optimizeImageElement(img as HTMLImageElement));

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;

          if (node.tagName === 'IMG') {
            optimizeImageElement(node as HTMLImageElement);
          }

          const childImages = node.querySelectorAll?.('img');
          childImages?.forEach((img) => optimizeImageElement(img as HTMLImageElement));
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
};
