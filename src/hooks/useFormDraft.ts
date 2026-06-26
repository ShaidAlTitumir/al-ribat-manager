import { useState, useEffect, useRef } from 'react';
import { safeStorage } from '../lib/safeStorage';

export function useFormDraft<T extends Record<string, any>>(
  storageKey: string,
  initialValues: T
) {
  const [values, setValues] = useState<T>(() => {
    try {
      const saved = safeStorage.getItem(storageKey);
      if (saved) {
        return { ...initialValues, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to parse form draft from safeStorage', e);
    }
    return initialValues;
  });

  const [isSavedIndicator, setIsSavedIndicator] = useState(false);
  const isFirstRender = useRef(true);

  // Check if form is dirty (different from initialValues)
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  // Auto-save on change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    try {
      if (isDirty) {
        safeStorage.setItem(storageKey, JSON.stringify(values));
        setIsSavedIndicator(true);
        const timer = setTimeout(() => setIsSavedIndicator(false), 2000);
        return () => clearTimeout(timer);
      } else {
        safeStorage.removeItem(storageKey);
        setIsSavedIndicator(false);
      }
    } catch (e) {
      console.error('Failed to save form draft to safeStorage', e);
    }
  }, [values, storageKey, isDirty]);

  // Handle browser tab close warning (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        const message = 'You have unsaved draft data, leave anyway?';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const clearDraft = () => {
    try {
      safeStorage.removeItem(storageKey);
      setValues(initialValues);
      setIsSavedIndicator(false);
    } catch (e) {
      console.error('Failed to clear form draft', e);
    }
  };

  return {
    values,
    setValues,
    clearDraft,
    isDirty,
    isSavedIndicator,
  };
}
