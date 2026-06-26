// src/lib/safeStorage.ts

class SafeStorage {
  private isSupported: boolean = false;
  private memoryCache: Record<string, string> = {};

  constructor() {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && window.localStorage !== null) {
        const testKey = '__storage_test__';
        window.localStorage.setItem(testKey, testKey);
        window.localStorage.removeItem(testKey);
        this.isSupported = true;
      }
    } catch (e) {
      this.isSupported = false;
      console.warn('SafeStorage: localStorage is not accessible or supported in this context.', e);
    }
  }

  getItem(key: string): string | null {
    if (this.isSupported) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch (e) {
        console.warn('SafeStorage: getItem failed', e);
      }
    }
    return this.memoryCache[key] !== undefined ? this.memoryCache[key] : null;
  }

  setItem(key: string, value: string): void {
    if (this.isSupported) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
      } catch (e) {
        console.warn('SafeStorage: setItem failed', e);
      }
    }
    this.memoryCache[key] = String(value);
  }

  removeItem(key: string): void {
    if (this.isSupported) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
          return;
        }
      } catch (e) {
        console.warn('SafeStorage: removeItem failed', e);
      }
    }
    delete this.memoryCache[key];
  }

  clear(): void {
    if (this.isSupported) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.clear();
          return;
        }
      } catch (e) {
        console.warn('SafeStorage: clear failed', e);
      }
    }
    this.memoryCache = {};
  }
}

export const safeStorage = new SafeStorage();
