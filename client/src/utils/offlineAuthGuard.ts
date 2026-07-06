/**
 * Offline Authentication Guard
 * Ensures users NEVER get logged out except by admin deletion
 * Handles: No WiFi, network failures, server crashes, browser restarts
 */

interface User {
  id: number;
  name: string;
  email: string;
  customerNumber: string;
  loginTime?: number;
  lastActivity?: number;
  persistentSession?: boolean;
}

export class OfflineAuthGuard {
  private static STORAGE_KEYS = {
    USER: 'bankingUser',
    USER_BACKUP: 'bankingUserBackup',
    SESSION_BACKUP: 'bankingUser_sessionBackup',
    LAST_ONLINE: 'lastOnlineTimestamp',
    OFFLINE_MODE: 'offlineMode',
    AUTH_PERMANENT: 'authPermanent'
  };

  /**
   * Initialize offline authentication on app load
   */
  static initialize() {
    // Mark auth as permanent (never expires)
    localStorage.setItem(this.STORAGE_KEYS.AUTH_PERMANENT, 'true');
    
    // Listen for network status changes
    this.setupNetworkListeners();
    
    // Protect user data from being cleared
    this.protectUserData();
  }

  /**
   * Setup network status listeners
   */
  private static setupNetworkListeners() {
    // Online event
    window.addEventListener('online', () => {
      console.log('📶 Network restored - user still logged in');
      localStorage.setItem(this.STORAGE_KEYS.LAST_ONLINE, Date.now().toString());
      localStorage.setItem(this.STORAGE_KEYS.OFFLINE_MODE, 'false');
    });

    // Offline event
    window.addEventListener('offline', () => {
      console.log('📵 Network lost - keeping user logged in offline');
      localStorage.setItem(this.STORAGE_KEYS.OFFLINE_MODE, 'true');
      
      // Backup user data in case localStorage gets corrupted
      this.backupUserData();
    });
  }

  /**
   * Backup user data to multiple storage locations
   */
  static backupUserData() {
    try {
      const userData = localStorage.getItem(this.STORAGE_KEYS.USER);
      if (userData) {
        // Backup to multiple keys
        localStorage.setItem(this.STORAGE_KEYS.USER_BACKUP, userData);
        localStorage.setItem(this.STORAGE_KEYS.SESSION_BACKUP, userData);
        sessionStorage.setItem(this.STORAGE_KEYS.USER, userData);
        sessionStorage.setItem(this.STORAGE_KEYS.USER_BACKUP, userData);
      }
    } catch (error) {
      console.error('Failed to backup user data:', error);
    }
  }

  /**
   * Restore user data from backups
   */
  static restoreUserData(): User | null {
    // Try all possible storage locations
    const locations = [
      () => localStorage.getItem(this.STORAGE_KEYS.USER),
      () => localStorage.getItem(this.STORAGE_KEYS.USER_BACKUP),
      () => localStorage.getItem(this.STORAGE_KEYS.SESSION_BACKUP),
      () => sessionStorage.getItem(this.STORAGE_KEYS.USER),
      () => sessionStorage.getItem(this.STORAGE_KEYS.USER_BACKUP),
    ];

    for (const getStorage of locations) {
      try {
        const data = getStorage();
        if (data) {
          const user = JSON.parse(data);
          // Restore to all locations
          this.saveUserData(user);
          return user;
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  /**
   * Save user data to all storage locations
   */
  static saveUserData(user: User) {
    const userData = JSON.stringify(user);
    
    try {
      localStorage.setItem(this.STORAGE_KEYS.USER, userData);
      localStorage.setItem(this.STORAGE_KEYS.USER_BACKUP, userData);
      localStorage.setItem(this.STORAGE_KEYS.SESSION_BACKUP, userData);
      sessionStorage.setItem(this.STORAGE_KEYS.USER, userData);
      sessionStorage.setItem(this.STORAGE_KEYS.USER_BACKUP, userData);
    } catch (error) {
      console.error('Failed to save user data:', error);
    }
  }

  /**
   * Check if user is in offline mode
   */
  static isOffline(): boolean {
    return !navigator.onLine || localStorage.getItem(this.STORAGE_KEYS.OFFLINE_MODE) === 'true';
  }

  /**
   * Check if auth should persist (always true except admin deletion)
   */
  static shouldPersistAuth(): boolean {
    return localStorage.getItem(this.STORAGE_KEYS.AUTH_PERMANENT) === 'true';
  }

  /**
   * Protect user data from accidental clearing
   */
  private static protectUserData() {
    // Periodically backup user data
    setInterval(() => {
      this.backupUserData();
    }, 30000); // Every 30 seconds
  }

  /**
   * Handle network request failure
   */
  static handleNetworkFailure(error: any): 'stay_logged_in' | 'logout' {
    // Network errors - keep user logged in
    if (
      error instanceof TypeError && 
      (error.message.includes('fetch') || error.message.includes('network'))
    ) {
      console.log('🌐 Network error - user stays logged in');
      localStorage.setItem(this.STORAGE_KEYS.OFFLINE_MODE, 'true');
      return 'stay_logged_in';
    }

    // Server errors (5xx) - keep user logged in
    if (error.message && /^5\d{2}:/.test(error.message)) {
      console.log('🔧 Server error - user stays logged in');
      return 'stay_logged_in';
    }

    // Admin deletion (specific 401/403 with logout flag) - force logout
    if (error.message && error.message.includes('Account access revoked')) {
      console.log('🚫 Admin deletion - forcing logout');
      return 'logout';
    }

    // All other errors - stay logged in
    console.log('⚠️ Unknown error - user stays logged in by default');
    return 'stay_logged_in';
  }

  /**
   * Returns the customer number of the identity currently stored in the
   * auth keys, or null if none/unreadable.
   */
  static getStoredCustomerNumber(): string | null {
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of [this.STORAGE_KEYS.USER, this.STORAGE_KEYS.USER_BACKUP, this.STORAGE_KEYS.SESSION_BACKUP]) {
        try {
          const data = storage.getItem(key);
          if (data) {
            const user = JSON.parse(data);
            if (user && user.customerNumber) return String(user.customerNumber);
          }
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  /**
   * Remove ONLY the stored identity (all bankingUser copies in both
   * storages) without touching caches/IndexedDB. Used when a specific
   * customer is permanently deleted, so their identity can't be restored
   * as "logged in" on the next app launch.
   */
  static clearStoredIdentity() {
    const identityKeys = [
      this.STORAGE_KEYS.USER,
      this.STORAGE_KEYS.USER_BACKUP,
      this.STORAGE_KEYS.SESSION_BACKUP,
    ];
    identityKeys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }

  /**
   * Clear all user data (admin deletion only)
   */
  static clearAllUserData() {
    // Clear all storage locations
    const keys = Object.values(this.STORAGE_KEYS);
    keys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    // Clear IndexedDB
    if ('indexedDB' in window) {
      indexedDB.databases().then(databases => {
        databases.forEach(db => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      }).catch(() => {});
    }

    // Clear caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
  }
}
