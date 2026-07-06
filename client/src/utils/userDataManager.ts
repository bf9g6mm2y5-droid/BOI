// User Data Management System
// Handles isolated data storage for each user account.
//
// Storage model: localStorage `user_<customerNumber>_<key>` entries are the
// single source of truth on the device; `dataCache` is a plain in-memory
// read-through mirror of those entries and is NEVER persisted itself. (An
// earlier version also serialized the whole cache into
// `userDataManager_cache` localStorage blobs on a 30s interval - that stored
// a second copy of every user's data under a key that per-user wipes didn't
// match, so deleted/stale data could be resurrected into the cache on the
// next launch. That system was removed; keep the cache memory-only.)

import { OfflineAuthGuard } from './offlineAuthGuard';

export interface UserData {
  customerNumber: string;
  name: string;
  email: string;
  phone: string;
  pin: string;
  address?: string;
  dateOfBirth?: string;
  joinDate: string;
  dateCreated: string;
  currency?: string;
}

export class UserDataManager {
  private static currentUser: string | null = null;
  private static dataCache: Map<string, any> = new Map();

  // Set the current active user
  static setCurrentUser(customerNumber: string) {
    // Drop any other user's entries from the in-memory cache when the
    // active user changes - reads are already namespaced per user, but
    // there's no reason to keep another account's data in memory.
    if (this.currentUser && this.currentUser !== customerNumber) {
      this.evictUserFromCache(this.currentUser);
    }

    this.currentUser = customerNumber;
    localStorage.setItem('currentUser', customerNumber);
    // Also store as last active user for biometric authentication
    this.setLastActiveUser(customerNumber);
  }

  // Remove all in-memory cache entries belonging to one user
  private static evictUserFromCache(customerNumber: string) {
    const prefix = `${customerNumber}_`;
    Array.from(this.dataCache.keys()).forEach(key => {
      if (key.startsWith(prefix)) {
        this.dataCache.delete(key);
      }
    });
  }

  // Get the current active user
  static getCurrentUser(): string | null {
    if (!this.currentUser) {
      this.currentUser = localStorage.getItem('currentUser');
    }
    return this.currentUser;
  }

  // Clear current user session - DISABLED: Only admin deletion should log users out
  static clearCurrentUser() {
    // This method is disabled to prevent automatic logouts
    // Users can only be logged out via admin deletion
    console.warn('clearCurrentUser() disabled - users can only be logged out via admin deletion');
    return;
  }

  // Store last active user for biometric authentication
  static setLastActiveUser(customerNumber: string) {
    localStorage.setItem('lastActiveUser', customerNumber);
  }

  // Get last active user for biometric authentication
  static getLastActiveUser(): string | null {
    return localStorage.getItem('lastActiveUser');
  }

  // Get formatted last login time
  static getLastLoginTime(): string {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return 'Never';
    
    const lastLoginKey = `lastLogin_${currentUser}`;
    const lastLoginTimestamp = localStorage.getItem(lastLoginKey);
    
    if (!lastLoginTimestamp) return 'Never';
    
    const date = new Date(parseInt(lastLoginTimestamp));
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${hours}.${minutes} GMT, ${day}/${month}/${year}`;
  }

  // Record login time
  static recordLoginTime(customerNumber: string) {
    const loginKey = `lastLogin_${customerNumber}`;
    localStorage.setItem(loginKey, Date.now().toString());
  }

  // Get user profile by customer number
  static getUserProfileByCustomerNumber(customerNumber: string): UserData | null {
    try {
      const allUsers = this.getAllUsers();
      return allUsers[customerNumber] || null;
    } catch (error) {
      console.error('Error getting user profile by customer number:', error);
      return null;
    }
  }

  // Get user-specific storage key
  private static getUserKey(key: string): string {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }
    return `user_${currentUser}_${key}`;
  }

  // Store user-specific data. Safe no-op (with a warning) when no user is
  // logged in - previously this threw an uncaught error from getUserKey(),
  // crashing whichever flow tried to write during login/logout transitions.
  static setUserData(key: string, data: any) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      console.warn(`setUserData('${key}') ignored - no user is currently logged in`);
      return;
    }

    localStorage.setItem(`user_${currentUser}_${key}`, JSON.stringify(data));

    // Keep the in-memory cache in sync so a subsequent getUserData() call
    // (e.g. balance re-read on another page) doesn't return a stale cached
    // value from before this write - this was the cause of balances
    // appearing to "glitch"/revert after a transfer.
    this.dataCache.set(`${currentUser}_${key}`, data);
  }

  // Retrieve user-specific data with caching
  static getUserData(key: string, defaultValue: any = null) {
    try {
      const userKey = this.getUserKey(key);
      const cacheKey = `${this.getCurrentUser()}_${key}`;

      const cachedData = this.dataCache.get(cacheKey);
      if (cachedData !== undefined) {
        return cachedData;
      }

      // Get from localStorage
      const stored = localStorage.getItem(userKey);
      const data = stored ? JSON.parse(stored) : defaultValue;

      // Cache the result
      this.dataCache.set(cacheKey, data);

      return data;
    } catch (error) {
      return defaultValue;
    }
  }

  // Drop in-memory cache entries so the next read comes from localStorage.
  // Data itself is untouched - localStorage remains the source of truth.
  static clearCache(key?: string) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;

    if (key) {
      this.dataCache.delete(`${currentUser}_${key}`);
    } else {
      this.evictUserFromCache(currentUser);
    }
  }

  // Get all registered users
  static getAllUsers(): { [customerNumber: string]: UserData } {
    return JSON.parse(localStorage.getItem('bankUsers') || '{}');
  }

  // Register a new user
  static async registerUser(userData: UserData) {
    // Save to database first
    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user in database');
      }

      console.log('✅ User saved to database successfully');
    } catch (error) {
      console.error('Database save failed:', error);
      // Continue with localStorage save for backward compatibility
    }

    // Also save to localStorage for immediate availability
    const existingUsers = this.getAllUsers();
    existingUsers[userData.customerNumber] = userData;
    localStorage.setItem('bankUsers', JSON.stringify(existingUsers));
  }

  // Get user profile data
  static getUserProfile(): UserData | null {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return null;

    const allUsers = this.getAllUsers();
    return allUsers[currentUser] || null;
  }

  // Update user profile
  static updateUserProfile(updates: Partial<UserData>) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;

    const allUsers = this.getAllUsers();
    if (allUsers[currentUser]) {
      const previousData = { ...allUsers[currentUser] };
      allUsers[currentUser] = { ...allUsers[currentUser], ...updates };
      localStorage.setItem('bankUsers', JSON.stringify(allUsers));
      
      // Dispatch storage event for cross-component synchronization
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'bankUsers',
        newValue: JSON.stringify(allUsers),
        oldValue: JSON.stringify({ ...allUsers, [currentUser]: previousData })
      }));
      
      // Dispatch comprehensive profile update events
      const updatedProfile = allUsers[currentUser];
      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: updatedProfile
      }));
      
      window.dispatchEvent(new CustomEvent('userProfileUpdate', {
        detail: updatedProfile
      }));
      
      // Dispatch specific events for name changes (affects cards)
      if (updates.name && updates.name !== previousData.name) {
        window.dispatchEvent(new CustomEvent('cardNameUpdate', {
          detail: { name: updates.name }
        }));
      }

      // Email synchronization across all user data
      if (updates.email && updates.email !== previousData.email) {
        console.log(`🔄 Email synchronization started: ${previousData.email} → ${updates.email}`);
        
        // Update email in all data stores that might contain user email
        UserDataManager.synchronizeEmailAcrossDataStores(currentUser, updates.email);
        
        // Dispatch email update event for other components
        window.dispatchEvent(new CustomEvent('emailUpdated', {
          detail: { 
            oldEmail: previousData.email, 
            newEmail: updates.email,
            customerNumber: currentUser
          }
        }));
        
        console.log(`✅ Email synchronization completed for customer ${currentUser}`);
      }
    }
  }

  // Email synchronization across all data stores
  static synchronizeEmailAcrossDataStores(customerNumber: string, newEmail: string) {
    try {
      // Update email in any profile-related data stores
      const profileData = this.getUserData('profile', {});
      if (profileData) {
        profileData.email = newEmail;
        this.setUserData('profile', profileData);
      }
      
      // Update email in contact information
      const contactData = this.getUserData('contactInfo', {});
      if (contactData) {
        contactData.email = newEmail;
        this.setUserData('contactInfo', contactData);
      }
      
      console.log(`📧 Email synchronized across all data stores for ${customerNumber}`);
    } catch (error) {
      console.error('Failed to synchronize email across data stores:', error);
    }
  }

  // User-specific account operations - returns only real accounts from database
  static getUserAccounts() {
    // Return empty array as default - real accounts must come from server API
    return this.getUserData('bankAccounts', []);
  }

  static setUserAccounts(accounts: any[]) {
    this.setUserData('bankAccounts', accounts);
  }

  // User-specific transaction operations
  static getUserTransactions() {
    return this.getUserData('bankTransactions', []);
  }

  static setUserTransactions(transactions: any[]) {
    this.setUserData('bankTransactions', transactions);
  }

  // User-specific payee operations
  static getUserPayees() {
    return this.getUserData('savedPayees', []);
  }

  static setUserPayees(payees: any[]) {
    this.setUserData('savedPayees', payees);
  }

  // Recent payees operations
  static getRecentPayees() {
    return this.getUserData('recentPayees', []);
  }

  static addRecentPayee(payee: { name: string; accountInfo: string; transferType: string; timestamp: string; reference?: string; bicCode?: string }) {
    const recentPayees = this.getRecentPayees();
    
    // Check if payee already exists (by name and account info)
    const existingIndex = recentPayees.findIndex((p: any) => 
      p.name === payee.name && p.accountInfo === payee.accountInfo
    );
    
    const isNewPayee = existingIndex === -1;
    
    if (existingIndex !== -1) {
      // Update existing payee timestamp and move to front
      recentPayees.splice(existingIndex, 1);
    }
    
    // Add to front of list
    recentPayees.unshift(payee);
    
    // Keep only last 10 recent payees
    const updatedPayees = recentPayees.slice(0, 10);
    
    this.setUserData('recentPayees', updatedPayees);
    
    // Send notification only for new payees
    if (isNewPayee) {
      import('./notifications').then(({ sendNewPayeeNotification }) => {
        sendNewPayeeNotification(payee.name, payee.accountInfo);
      });
    }
    
    return updatedPayees;
  }

  static removeRecentPayee(name: string, accountInfo: string) {
    const recentPayees = this.getRecentPayees();
    const updatedPayees = recentPayees.filter((p: any) => 
      !(p.name === name && p.accountInfo === accountInfo)
    );
    this.setUserData('recentPayees', updatedPayees);
    return updatedPayees;
  }

  // Check if user exists
  static userExists(customerNumber: string): boolean {
    const allUsers = this.getAllUsers();
    return customerNumber in allUsers;
  }

  // Initialize fresh account data for new user only - accounts come from server
  static initializeFreshAccount(customerNumber: string) {
    // Set current user first
    this.setCurrentUser(customerNumber);
    
    // Only initialize fresh data if user has no existing account data
    const existingAccounts = this.getUserData('bankAccounts', null);
    if (existingAccounts === null) {
      // Initialize with empty arrays - real account comes from server API
      // Do NOT create fake hardcoded accounts
      this.setUserData('bankAccounts', []);
      this.setUserData('bankTransactions', []);
      this.setUserData('savedPayees', []);
      this.setUserData('recentPayees', []);
    }
  }

  // Clear current user's data (transactions, payees) but preserve accounts
  static clearCurrentUserData() {
    this.setUserData('bankTransactions', []);
    this.setUserData('savedPayees', []);
    // Keep accounts intact - don't clear them
  }

  // Remove specific user and their data - PROTECTED (admin-only)
  static removeUser(customerNumber: string, adminAuthorized = false) {
    if (!adminAuthorized) {
      console.warn(`removeUser(${customerNumber}) blocked - admin authorization required`);
      return;
    }
    
    // Only proceed if explicitly authorized by admin
    const allUsers = this.getAllUsers();
    delete allUsers[customerNumber];
    localStorage.setItem('bankUsers', JSON.stringify(allUsers));
    
    // Clear user-specific data
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(`user_${customerNumber}_`)) {
        localStorage.removeItem(key);
      }
    });
    
    console.log(`Admin authorized: User ${customerNumber} removed`);
  }

  // Completely wipe all data for a permanently deleted user
  static permanentlyWipeUserData(customerNumber: string) {
    // Guard for browser environment
    if (typeof window === 'undefined') return;
    
    console.log(`🔥 PERMANENTLY WIPING DATA FOR USER: ${customerNumber}`);
    
    try {
      // Remove from users list
      const allUsers = this.getAllUsers();
      delete allUsers[customerNumber];
      localStorage.setItem('bankUsers', JSON.stringify(allUsers));
      
      // Clear ALL localStorage keys related to this user
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (
          key.startsWith(`user_${customerNumber}_`) ||
          key.includes(customerNumber) ||
          key.startsWith(`lastLogin_${customerNumber}`)
        ) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear current user if it's the deleted one
      if (this.currentUser === customerNumber || localStorage.getItem('currentUser') === customerNumber) {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('lastActiveUser');
      }

      // CRITICAL: also clear the stored auth identity if it belongs to the
      // wiped customer. The bankingUser/backup keys hold the customer number
      // inside their JSON *value*, not the key name, so the key-name matching
      // above never removed them - which meant a permanently deleted user was
      // restored as "logged in" on the next launch, only to be wiped and
      // redirected again by the next heartbeat, in a loop.
      if (OfflineAuthGuard.getStoredCustomerNumber() === customerNumber) {
        OfflineAuthGuard.clearStoredIdentity();
      }
      
      // Clear session storage
      if (typeof sessionStorage !== 'undefined') {
        const sessionKeys = Object.keys(sessionStorage);
        sessionKeys.forEach(key => {
          if (key.includes(customerNumber)) {
            sessionStorage.removeItem(key);
          }
        });
      }
      
      // Clear IndexedDB data for this user
      if (typeof indexedDB !== 'undefined' && 'databases' in indexedDB) {
        indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name && (db.name.includes(customerNumber) || db.name.includes('bankingApp'))) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        }).catch(() => {});
      }
      
      // Clear caches
      if (typeof caches !== 'undefined') {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes(customerNumber) || name.includes('boi-mobile')) {
              caches.delete(name);
            }
          });
        }).catch(() => {});
      }
      
      // Clear in-memory cache
      this.dataCache.clear();

      // Remove the legacy persisted-cache blobs if they exist from an older
      // version of the app - they held a second copy of every user's data.
      localStorage.removeItem('userDataManager_cache');
      localStorage.removeItem('userDataManager_timestamps');

      console.log(`🔥 User ${customerNumber} data completely wiped`);
    } catch (e) {
      console.error('Error during permanent wipe:', e);
    }
  }

  // Clear temporary state for cold launch - PROTECTED
  static clearTemporaryState() {
    // Only clear in-memory cache - data persists in localStorage
    this.dataCache.clear();

    // Only clear truly temporary debug items - preserve user data
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('_debug_') || key.startsWith('temp_cache_')) {
        localStorage.removeItem(key);
      }
    });

    // Preserve all user session and authentication data
  }

  // Admin function to clear all data - PROTECTED (admin-only)
  static clearAllData(adminAuthorized = false) {
    if (!adminAuthorized) {
      console.warn('clearAllData() blocked - admin authorization required');
      return;
    }
    
    // Only proceed if explicitly authorized by admin
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('user_') || key === 'bankUsers' || key === 'currentUser') {
        localStorage.removeItem(key);
      }
    });
    
    // Reset current user
    this.currentUser = null;
    console.log('Admin authorized: All user data cleared');
  }

  // Admin-triggered cleanup - removes all traces of a deleted user
  static adminDeleteUser(customerNumber: string) {
    // Remove user from the users registry
    const allUsers = this.getAllUsers();
    if (allUsers[customerNumber]) {
      delete allUsers[customerNumber];
      localStorage.setItem('bankUsers', JSON.stringify(allUsers));
    }
    
    // Remove from current user if this was the active user
    if (this.currentUser === customerNumber) {
      this.currentUser = null;
      localStorage.removeItem('currentUser');
    }
    
    // Remove from last active user
    if (this.getLastActiveUser() === customerNumber) {
      localStorage.removeItem('lastActiveUser');
    }
    
    // Clear any cached data for this user (cache keys are `${customerNumber}_${key}`)
    this.evictUserFromCache(customerNumber);
    
    // Clear all user-specific localStorage entries
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (key.includes(customerNumber) || key.startsWith(`user_${customerNumber}_`)) {
        localStorage.removeItem(key);
      }
    }
    
    // Clear any temporary localStorage entries with customer reference
    for (const key of allKeys) {
      if (key.includes('temp_') && key.includes(customerNumber)) {
        localStorage.removeItem(key);
      }
    }
    
    console.log(`Admin cleanup: All data for customer ${customerNumber} removed from browser storage`);
  }
}