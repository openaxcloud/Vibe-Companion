const isLocalStorageAvailable = (() => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
})();

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (!isLocalStorageAvailable) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  
  setItem: (key: string, value: string): boolean => {
    if (!isLocalStorageAvailable) return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  
  removeItem: (key: string): boolean => {
    if (!isLocalStorageAvailable) return false;
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  
  setItem: (key: string, value: string): boolean => {
    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  
  removeItem: (key: string): boolean => {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};
