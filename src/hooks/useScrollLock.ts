import { useEffect } from 'react';

/**
 * Custom hook to lock body scroll when an overlay/modal is open.
 * @param lock - Boolean to indicate if scroll should be locked.
 */
export function useScrollLock(lock: boolean) {
  useEffect(() => {
    if (lock) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [lock]);
}
