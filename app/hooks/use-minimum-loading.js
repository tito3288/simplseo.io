import { useState, useEffect } from 'react';

export const useMinimumLoading = (isLoading, minimumTime = 3000) => {
  const [shouldShowLoader, setShouldShowLoader] = useState(false);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    if (isLoading && !shouldShowLoader) {
      // Start loading
      setShouldShowLoader(true);
      setStartTime(Date.now());
    } else if (!isLoading && shouldShowLoader) {
      // Check if minimum time has passed
      const elapsedTime = Date.now() - startTime;
      const remainingTime = minimumTime - elapsedTime;

      if (remainingTime > 0) {
        // Wait for remaining time before hiding loader
        const timer = setTimeout(() => {
          setShouldShowLoader(false);
        }, remainingTime);
        return () => clearTimeout(timer);
      } else {
        // Minimum time has passed, hide loader immediately
        setShouldShowLoader(false);
      }
    }
  }, [isLoading, shouldShowLoader, startTime, minimumTime]);

  return shouldShowLoader;
}; 