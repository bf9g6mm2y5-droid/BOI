// User Data Management System
// Handles isolated data storage for each user account

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
  private static cacheTimestamps: Map<string, number> = new Map();
  private static readonly CACHE_DURATION = null; // No cache expiration - permanent storage
  private static readonly CACHE_STORAGE_KEY = 'userDataManager_cache';
  private static readonly CACHE_TIMESTAMPS_KEY = 'userDataManager_timestamps';

  // Set the current active user
  static setCurrentUser(customerNumber: string) {
    this.currentUser = customerNumber;
    localStorage.setItem('currentUser', customerNumber);
    // Also store as last active user for biometric authentication
    this.setLastActiveUser(customerNumber);
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

  // Store user-specific data
  static setUserData(key: string, data: any) {
    const userKey = this.getUserKey(key);
    localStorage.setItem(userKey, JSON.stringify(data));

    // Keep the in-memory cache in sync so a subsequent getUserData() call
    // (e.g. balance re-read on another page) doesn't return a stale cached
    // value from before this write - this was the cause of balances
    // appearing to "glitch"/revert after a transfer.
    const cacheKey = `${this.getCurrentUser()}_${key}`;
    this.dataCache.set(cacheKey, data);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  // Retrieve user-specific data with caching
  static getUserData(key: string, defaultValue: any = null) {
    try {
      const userKey = this.getUserKey(key);
      const cacheKey = `${this.getCurrentUser()}_${key}`;
      
      // Check cache first - no expiration since CACHE_DURATION is null
      const cachedData = this.dataCache.get(cacheKey);
      
      if (cachedData !== undefined) {
        return cachedData;
      }
      
      // Get from localStorage
      const stored = localStorage.getItem(userKey);
      const data = stored ? JSON.parse(stored) : defaultValue;
      
      // Cache the result
      this.dataCache.set(cacheKey, data);
      this.cacheTimestamps.set(cacheKey, Date.now());
      
      return data;
    } catch (error) {
      return defaultValue;
    }
  }

  // Clear cache for specific user data - PROTECTED (preserve in localStorage)
  static clearCache(key?: string) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;

    // Save to localStorage before clearing memory cache
    this.saveCacheToStorage();

    if (key) {
      const cacheKey = `${currentUser}_${key}`;
      this.dataCache.delete(cacheKey);
      this.cacheTimestamps.delete(cacheKey);
    } else {
      // Clear all cache entries for current user (memory only)
      const userPrefix = `${currentUser}_`;
      this.dataCache.forEach((value, key) => {
        if (key.startsWith(userPrefix)) {
          this.dataCache.delete(key);
          this.cacheTimestamps.delete(key);
        }
      });
    }
    
    console.log('Memory cache cleared but data preserved in localStorage');
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
      this.cacheTimestamps.clear();
      
      console.log(`🔥 User ${customerNumber} data completely wiped`);
    } catch (e) {
      console.error('Error during permanent wipe:', e);
    }
  }

  // Clear temporary state for cold launch - PROTECTED
  static clearTemporaryState() {
    // Preserve cache in localStorage before clearing in-memory
    this.saveCacheToStorage();
    
    // Only clear in-memory cache - data persists in localStorage
    this.dataCache.clear();
    this.cacheTimestamps.clear();
    
    // Only clear truly temporary debug items - preserve user data
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('_debug_') || key.startsWith('temp_cache_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Preserve all user session and authentication data
  }

  // Save cache to localStorage for persistence across reloads
  private static saveCacheToStorage() {
    try {
      const cacheData = Object.fromEntries(this.dataCache.entries());
      const timestampData = Object.fromEntries(this.cacheTimestamps.entries());
      
      localStorage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(cacheData));
      localStorage.setItem(this.CACHE_TIMESTAMPS_KEY, JSON.stringify(timestampData));
    } catch (error) {
      console.error('Failed to save cache to storage:', error);
    }
  }

  // Restore cache from localStorage on initialization
  private static restoreCacheFromStorage() {
    try {
      const cacheData = localStorage.getItem(this.CACHE_STORAGE_KEY);
      const timestampData = localStorage.getItem(this.CACHE_TIMESTAMPS_KEY);
      
      if (cacheData) {
        const parsedCache = JSON.parse(cacheData);
        this.dataCache = new Map(Object.entries(parsedCache));
      }
      
      if (timestampData) {
        const parsedTimestamps = JSON.parse(timestampData);
        this.cacheTimestamps = new Map(Object.entries(parsedTimestamps).map(([k, v]) => [k, Number(v)]));
      }
    } catch (error) {
      console.error('Failed to restore cache from storage:', error);
    }
  }

  // Initialize cache persistence
  static initializeCachePersistence() {
    this.restoreCacheFromStorage();
    
    // Save cache periodically and on important operations
    setInterval(() => this.saveCacheToStorage(), 30000); // Every 30 seconds
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
    
    // Clear any cached data for this user
    this.dataCache.delete(customerNumber);
    this.cacheTimestamps.delete(customerNumber);
    
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