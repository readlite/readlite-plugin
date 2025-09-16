/**
 * Reading Progress Component
 * Shows a progress bar indicating reading position
 */

import React, { useState, useEffect } from 'react';

interface ReadingProgressProps {
  scrollContainer?: HTMLElement | null;
}

export const ReadingProgress: React.FC<ReadingProgressProps> = ({ scrollContainer }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollPosition = scrollContainer.scrollTop;
      const containerHeight = scrollContainer.clientHeight;
      const scrollHeight = scrollContainer.scrollHeight - containerHeight;

      if (scrollHeight <= 0) {
        setProgress(0);
        return;
      }

      const currentProgress = Math.min(
        100,
        Math.max(0, (scrollPosition / scrollHeight) * 100)
      );
      setProgress(currentProgress);
    };

    // Initial calculation
    handleScroll();

    // Add scroll listener
    scrollContainer.addEventListener('scroll', handleScroll);
    
    // Cleanup
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainer]);

  return (
    <div className="fixed top-0 left-0 w-full h-1.5 z-[9999] bg-accent/20 pointer-events-none">
      <div
        className="h-full transition-all duration-150 ease-out bg-accent"
        style={{ width: `${progress}%` }}
        aria-label={`Reading progress: ${Math.round(progress)}%`}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
};

export default ReadingProgress;