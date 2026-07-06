import { ChevronRight, ChevronDown, ChevronUp, User, Loader2, ArrowRightLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import SpendingVisualization from "../components/SpendingVisualization";
import SpendingInsights from "../components/SpendingInsights";
import { UserDataManager } from "../utils/userDataManager";
import { getPendingBalanceSyncs } from "../utils/transferUtils";
import { StateManager } from "../utils/stateManager";
import { formatCurrency, getUserCurrency, type Currency } from "../utils/currencyUtils";
import { applyThemeColor } from "../utils/themeColor";
import ukLogoPath from "@assets/IMG_1505_1759859367310.png";

interface Account {
  id: number;
  displayName: string;
  accountNumber: string;
  balance: string;
  accountType: string;
}

// Account type priority for sorting (current account always at top)
const getAccountTypePriority = (type: string): number => {
  const lowerType = (type || '').toLowerCase();
  if (lowerType === 'current' || lowerType.includes('current')) return 0;
  if (lowerType === 'savings' || lowerType.includes('savings')) return 1;
  if (lowerType === 'credit' || lowerType.includes('credit')) return 2;
  return 3; // Other accounts
};

// Sort accounts: current first, then savings, then credit, then others
const sortAccountsForDisplay = (accountsList: any[]): any[] => {
  if (!Array.isArray(accountsList)) return [];
  return [...accountsList].sort((a, b) => {
    const priorityA = getAccountTypePriority(a.accountType);
    const priorityB = getAccountTypePriority(b.accountType);
    if (priorityA !== priorityB) return priorityA - priorityB;
    // If same type, sort by display name
    return (a.displayName || '').localeCompare(b.displayName || '');
  });
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Local state for account balances that can be updated by transfers
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userCurrency, setUserCurrency] = useState<Currency>(() => getUserCurrency());
  
  useEffect(() => {
    // Ensure theme-color is correct for the main app
    applyThemeColor();
  }, []);

  // Touch-safe interaction state
  const [loadingAccountId, setLoadingAccountId] = useState<number | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const lastTapTimeRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number; accountId: number } | null>(null);
  
  // Send money dropdown state
  const [sendMoneyOpen, setSendMoneyOpen] = useState(false);
  const [transferType, setTransferType] = useState<'uk' | 'iban'>('uk');
  const [selectedFromAccount, setSelectedFromAccount] = useState<string>('');
  const [selectedPayee, setSelectedPayee] = useState<string>('');
  const [payees, setPayees] = useState<any[]>([]);
  
  // Monthly insights state
  const [monthlyInsights, setMonthlyInsights] = useState<{
    currentMonth: { name: string; moneyIn: number; moneyOut: number };
    previousMonth: { name: string; moneyIn: number; moneyOut: number };
    currentDate: string;
  }>({
    currentMonth: { name: '', moneyIn: 0, moneyOut: 0 },
    previousMonth: { name: '', moneyIn: 0, moneyOut: 0 },
    currentDate: ''
  });

  // Account deletion state - blocks navigation
  const [accountDeleted, setAccountDeleted] = useState(false);

  // Check account status on mount
  useEffect(() => {
    const checkAccountStatus = async () => {
      const currentUser = UserDataManager.getCurrentUser();
      if (!currentUser) return;
      
      try {
        const response = await fetch(`/api/profile/${currentUser}`);
        if (response.status === 410 || response.status === 401) {
          const data = await response.json().catch(() => ({}));
          if (data.accountDeleted || data.blockAllFunctions) {
            setAccountDeleted(true);
          }
        }
      } catch (error) {
        // Ignore errors
      }
    };
    
    checkAccountStatus();
  }, []);

  // Navigation with account deleted check
  const navigateWithAnimation = (path: string) => {
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }
    setLocation(path);
  };

  // Load accounts from server API on mount
  useEffect(() => {
    // Ensure there's a current user
    let currentUser = UserDataManager.getCurrentUser();
    if (!currentUser) {
      // No user logged in - redirect to login
      setLocation('/login');
      return;
    }
    
    // First try to load cached accounts from localStorage (already sorted if saved properly)
    let storedAccounts = UserDataManager.getUserData('bankAccounts', []);
    if (storedAccounts && storedAccounts.length > 0) {
      // Always sort when loading from cache to ensure correct order
      setAccounts(sortAccountsForDisplay(storedAccounts));
    }

    // Fetch real accounts from server API (server is source of truth for balance)
    fetch('/api/accounts', { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch accounts');
      })
      .then(serverAccounts => {
        if (serverAccounts && serverAccounts.length > 0) {
          // Check for locally-processed transfers not yet synced to server
          const pendingSyncs = getPendingBalanceSyncs();

          // Format accounts for display (mask account numbers, ensure proper structure)
          const formattedAccounts = serverAccounts.map((acc: any) => {
            const accountId = String(acc.id);
            // If there's a pending local balance sync for this account, use the local balance
            // so the server doesn't overwrite a transfer the user just made while offline
            const protectedBalance = pendingSyncs[accountId] ?? (acc.balance || '0.00');
            if (pendingSyncs[accountId]) {
              console.log(`🔒 Protecting local balance for account ${accountId}: ${protectedBalance} (server had ${acc.balance})`);
            }
            return {
              id: acc.id,
              displayName: acc.displayName || acc.display_name || 'Current Account',
              accountNumber: acc.accountNumber?.startsWith('****') 
                ? acc.accountNumber 
                : `~ ${acc.accountNumber?.slice(-4) || '0000'}`,
              balance: protectedBalance,
              accountType: acc.accountType || acc.account_type || 'current',
              sortCode: acc.sortCode || acc.sort_code || '90-78-68',
              bic: acc.bic || 'BOFIIE2D',
              iban: acc.iban || null,
              fullAccountNumber: acc.accountNumber || acc.account_number
            };
          });
          
          // Sort accounts with current account at top
          const sortedAccounts = sortAccountsForDisplay(formattedAccounts);
          
          // Store sorted accounts locally for offline access
          UserDataManager.setUserData('bankAccounts', sortedAccounts);
          setAccounts(sortedAccounts);
          console.log('💳 Loaded accounts from server (sorted):', sortedAccounts.length, sortedAccounts);
        }
      })
      .catch(err => {
        console.log('Using cached accounts:', err.message);
        // Keep using cached accounts if server fetch fails, but ensure they're sorted
        if (storedAccounts && storedAccounts.length > 0) {
          setAccounts(sortAccountsForDisplay(storedAccounts));
        }
      });
    
    // Initialize empty transactions array if needed
    if (!UserDataManager.getUserData('bankTransactions', null)) {
      UserDataManager.setUserData('bankTransactions', []);
    }
    
    // Load recent payees (saved after successful transfers)
    const recentPayees = UserDataManager.getRecentPayees();
    setPayees(recentPayees);
    
    // Load user's currency preference
    setUserCurrency(getUserCurrency());
    
    // Detect touch device
    const checkTouchDevice = () => {
      setIsTouchDevice(
        'ontouchstart' in window || 
        navigator.maxTouchPoints > 0 || 
        (navigator as any).msMaxTouchPoints > 0
      );
    };
    checkTouchDevice();
    
    // Calculate monthly insights from ALL accounts combined
    const calculateMonthlyInsights = () => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      let currentMonthIn = 0;
      let currentMonthOut = 0;
      let previousMonthIn = 0;
      let previousMonthOut = 0;
      
      // Get transactions from main bankTransactions
      const mainTransactions = UserDataManager.getUserData('bankTransactions', []) || [];
      
      // Also check for account-specific transactions
      const accounts = UserDataManager.getUserData('bankAccounts', []) || [];
      let allTransactions = [...mainTransactions];
      
      // Collect transactions from each account if stored separately
      if (Array.isArray(accounts)) {
        accounts.forEach((account: any) => {
          const accountTransactions = UserDataManager.getUserData(`transactions_${account.id}`, []) || [];
          allTransactions = [...allTransactions, ...accountTransactions];
        });
      }
      
      // Remove duplicates by transaction id if present
      const seenIds = new Set();
      const uniqueTransactions = allTransactions.filter((tx: any) => {
        if (tx.id && seenIds.has(tx.id)) {
          return false;
        }
        if (tx.id) seenIds.add(tx.id);
        return true;
      });
      
      uniqueTransactions.forEach((tx: any) => {
        // Try parsing date in multiple formats
        let txDate: Date;
        if (tx.date) {
          txDate = new Date(tx.date);
        } else if (tx.timestamp) {
          txDate = new Date(tx.timestamp);
        } else if (tx.createdAt) {
          txDate = new Date(tx.createdAt);
        } else {
          return; // Skip if no date
        }
        
        // Check if date is valid
        if (isNaN(txDate.getTime())) return;
        
        const txMonth = txDate.getMonth();
        const txYear = txDate.getFullYear();
        
        // Parse amount - handle string with currency symbols
        let amount = 0;
        if (typeof tx.amount === 'number') {
          amount = tx.amount;
        } else if (typeof tx.amount === 'string') {
          amount = parseFloat(tx.amount.replace(/[^0-9.-]/g, '')) || 0;
        }
        
        // Determine if it's money in or out based on type or amount sign
        const isMoneyOut = tx.type === 'debit' || tx.type === 'withdrawal' || tx.type === 'transfer_out' || amount < 0;
        const isMoneyIn = tx.type === 'credit' || tx.type === 'deposit' || tx.type === 'transfer_in' || amount > 0;
        
        const absAmount = Math.abs(amount);
        
        if (txMonth === currentMonth && txYear === currentYear) {
          if (isMoneyIn && amount > 0) {
            currentMonthIn += absAmount;
          } else if (isMoneyOut || amount < 0) {
            currentMonthOut += absAmount;
          }
        } else if (txMonth === previousMonth && txYear === previousYear) {
          if (isMoneyIn && amount > 0) {
            previousMonthIn += absAmount;
          } else if (isMoneyOut || amount < 0) {
            previousMonthOut += absAmount;
          }
        }
      });
      
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      
      setMonthlyInsights({
        currentMonth: { name: monthNames[currentMonth], moneyIn: currentMonthIn, moneyOut: currentMonthOut },
        previousMonth: { name: monthNames[previousMonth], moneyIn: previousMonthIn, moneyOut: previousMonthOut },
        currentDate: `${day}/${month}`
      });
    };
    
    calculateMonthlyInsights();
  }, []);

  // Listen for balance updates from transfers and admin profile updates
  useEffect(() => {
    const handleBalanceUpdate = (event: CustomEvent) => {
      const { accountId, newBalance, accounts: updatedAccounts } = event.detail || {};
      
      // If updated accounts are provided in the event, use them (already sorted from source)
      if (updatedAccounts) {
        setAccounts(sortAccountsForDisplay(updatedAccounts));
      } else {
        // Otherwise, refresh from UserDataManager to get latest data
        UserDataManager.clearCache('bankAccounts');
        const freshAccounts = UserDataManager.getUserData('bankAccounts', []);
        if (Array.isArray(freshAccounts) && freshAccounts.length > 0) {
          setAccounts(sortAccountsForDisplay(freshAccounts));
        } else {
          // Fallback to updating individual account (preserve current sort order)
          setAccounts(prev => sortAccountsForDisplay(prev.map(acc => 
            acc.id === accountId ? { ...acc, balance: newBalance } : acc
          )));
        }
      }
    };

    const handleProfileUpdate = async () => {
      // Reload user data when admin updates profile
      const currentUser = UserDataManager.getCurrentUser();
      if (currentUser) {
        try {
          const response = await fetch(`/api/profile/${currentUser}?t=${Date.now()}`);
          if (response.ok) {
            const userData = await response.json();
            // Update UserDataManager with fresh data
            UserDataManager.updateUserProfile({
              name: userData.name,
              email: userData.email,
              phone: userData.phone || "",
              customerNumber: userData.customerNumber,
              dateOfBirth: userData.dateOfBirth || "",
              address: userData.address || "",
              joinDate: userData.joinDate || "Member since 2018"
            });
            
            // Refresh accounts if they may have changed
            const updatedAccounts = UserDataManager.getUserData('bankAccounts', accounts);
            setAccounts(sortAccountsForDisplay(updatedAccounts));
          }
        } catch (error) {
          console.error('Failed to refresh profile data:', error);
        }
      }
    };

    const handleAccountsReset = (event: any) => {
      if (event.detail?.accounts) {
        setAccounts(sortAccountsForDisplay(event.detail.accounts));
        UserDataManager.clearCache();
      }
    };

    const handleAccountsUpdate = (event: CustomEvent) => {
      const { accounts: updatedAccounts, source, newAccount } = event.detail || {};
      
      console.log('Dashboard received accountsUpdate:', { source, newAccount, accountsCount: updatedAccounts?.length });
      
      if (updatedAccounts) {
        // Clear cache and force fresh data
        UserDataManager.clearCache('bankAccounts');
        const sortedAccounts = sortAccountsForDisplay(updatedAccounts);
        setAccounts(sortedAccounts);
        
        // Also update localStorage for immediate access by other components
        localStorage.setItem('bankAccounts', JSON.stringify(sortedAccounts));
      }
    };

    const handleTransactionDeleted = (event: CustomEvent) => {
      const { accountId, transactions, accounts: updatedAccounts } = event.detail || {};
      
      // Clear cache to ensure fresh data
      UserDataManager.clearCache('bankAccounts');
      UserDataManager.clearCache('bankTransactions');
      
      // Update accounts if provided
      if (updatedAccounts) {
        setAccounts(sortAccountsForDisplay(updatedAccounts));
      } else {
        // Refresh accounts from storage
        const freshAccounts = UserDataManager.getUserData('bankAccounts', []);
        if (Array.isArray(freshAccounts) && freshAccounts.length > 0) {
          setAccounts(sortAccountsForDisplay(freshAccounts));
        }
      }
    };

    const handleForceRefresh = () => {
      // Force complete refresh of all data
      UserDataManager.clearCache();
      const freshAccounts = UserDataManager.getUserData('bankAccounts', []);
      if (Array.isArray(freshAccounts) && freshAccounts.length > 0) {
        setAccounts(sortAccountsForDisplay(freshAccounts));
      }
    };

    window.addEventListener('balanceUpdate', handleBalanceUpdate as EventListener);
    window.addEventListener('adminProfileUpdate', handleProfileUpdate as EventListener);
    window.addEventListener('userProfileUpdate', handleProfileUpdate as EventListener);
    window.addEventListener('accountsReset', handleAccountsReset as EventListener);
    window.addEventListener('accountsUpdate', handleAccountsUpdate as EventListener);
    window.addEventListener('transactionDeleted', handleTransactionDeleted as EventListener);
    window.addEventListener('transactionUpdate', handleTransactionDeleted as EventListener);
    window.addEventListener('forceRefresh', handleForceRefresh as EventListener);
    
    return () => {
      window.removeEventListener('balanceUpdate', handleBalanceUpdate as EventListener);
      window.removeEventListener('adminProfileUpdate', handleProfileUpdate as EventListener);
      window.removeEventListener('userProfileUpdate', handleProfileUpdate as EventListener);
      window.removeEventListener('accountsReset', handleAccountsReset as EventListener);
      window.removeEventListener('accountsUpdate', handleAccountsUpdate as EventListener);
      window.removeEventListener('transactionDeleted', handleTransactionDeleted as EventListener);
      window.removeEventListener('transactionUpdate', handleTransactionDeleted as EventListener);
      window.removeEventListener('forceRefresh', handleForceRefresh as EventListener);
    };
  }, [accounts]);

  // Store accounts in localStorage for transfer forms to access
  useEffect(() => {
    localStorage.setItem('bankAccounts', JSON.stringify(accounts));
  }, [accounts]);

  // Handle scroll position persistence
  useEffect(() => {
    // Restore scroll position after component mounts
    StateManager.restoreScrollPosition('/dashboard', '.main-scroll-container');
    
    // Save scroll position on scroll
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        StateManager.saveScrollPosition('/dashboard', scrollContainerRef.current.scrollTop);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Get color for account type
  const getAccountColor = (accountType: string) => {
    switch (accountType) {
      case 'current': return 'bg-blue-500';
      case 'credit': return 'bg-red-500';
      case 'savings': return 'bg-green-500';
      case 'loan': return 'bg-orange-500';
      case 'deposit': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  // Touch-safe navigation with tap guard and loading state
  const handleAccountTap = (accountId: number) => {
    // Block if account deleted
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }
    
    const now = Date.now();
    const TAP_GUARD_MS = 400;
    
    // Ignore rapid repeat taps
    if (now - lastTapTimeRef.current < TAP_GUARD_MS) {
      return;
    }
    
    // Ignore if already loading or navigating
    if (loadingAccountId !== null || isNavigating) {
      return;
    }
    
    // Update state atomically
    lastTapTimeRef.current = now;
    setLoadingAccountId(accountId);
    
    // Navigate after showing loading state
    setTimeout(() => {
      navigateWithAnimation(`/transactions/${accountId}`);
      // Reset loading state after navigation
      setTimeout(() => setLoadingAccountId(null), 300);
    }, 50);
  };

  // Touch event handlers for drag detection
  const handleTouchStart = (e: React.TouchEvent, accountId: number) => {
    if (isTouchDevice) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        accountId
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, accountId: number) => {
    if (!isTouchDevice || !touchStartRef.current) return;
    
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    const DRAG_THRESHOLD = 10; // pixels
    
    // Only trigger tap if movement is below threshold
    if (deltaX < DRAG_THRESHOLD && deltaY < DRAG_THRESHOLD && touchStartRef.current.accountId === accountId) {
      handleAccountTap(accountId);
    }
    
    touchStartRef.current = null;
  };

  const handleTouchMove = () => {
    // Clear touch start on scroll/drag to prevent accidental taps
    if (touchStartRef.current) {
      touchStartRef.current = null;
    }
  };

  return (
    <div className="page-container h-screen bg-white overflow-hidden flex flex-col ios-safe-bottom relative">
      {/* Ambient spending visualization background */}
      <SpendingVisualization />
      
      {/* Blue header bar */}
      <div className="bg-[#126987] flex items-end justify-between px-4 pb-3 pt-8 flex-shrink-0" style={{ paddingTop: 'calc(32px + env(safe-area-inset-top, 0px))' }}>
        <div className="flex items-center">
          <img 
            src={userCurrency === 'GBP' ? ukLogoPath : "/boi_logo.svg"} 
            alt={userCurrency === 'GBP' ? "Bank of Ireland UK" : "Bank of Ireland"} 
            className={`${userCurrency === 'GBP' ? 'h-7' : 'h-6'} filter brightness-0 invert`}
          />
        </div>
        <div className="flex items-center">
          <button 
            className="text-white hover:bg-white/20 h-8 w-8 rounded-full flex items-center justify-center touch-manipulation transform-gpu transition-all duration-150 ease-out active:scale-95 android-no-highlight"
            onClick={() => navigateWithAnimation('/profile')}
            style={{
              WebkitTapHighlightColor: 'transparent',
              outline: 'none'
            }}
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Header with scenic background */}
      <div className="text-white relative flex-shrink-0 h-36">
        {/* Full scenic background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('/background.jpg')`
          }}
        />
        
        <div className="relative z-10 h-full flex flex-col justify-center px-4">
          <h1 className="text-2xl font-light mb-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>Welcome</h1>
          <p className="text-white/90 text-sm font-light" style={{ fontFamily: 'OpenSans, sans-serif' }}>
            Last login: {UserDataManager.getLastLoginTime()}
          </p>
        </div>
      </div>

      {/* Send money section - fixed */}
      <div className="bg-white flex-shrink-0 -mt-8 relative z-10">
        <button 
          className="w-full flex items-center justify-between px-4 py-2"
          onClick={() => setSendMoneyOpen(!sendMoneyOpen)}
        >
          <div className="flex items-center">
            <div className="w-7 h-7 rounded-full border border-[#2d6a7a] flex items-center justify-center mr-3">
              <ArrowRightLeft className="h-3.5 w-3.5 text-[#2d6a7a]" />
            </div>
            <span className="text-base text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>Send money</span>
          </div>
          {sendMoneyOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
        
        {/* Expanded send money form */}
        {sendMoneyOpen && (
          <div className="px-4 pb-4 bg-white">
            {/* Transfer Type */}
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>Transfer type</p>
              <div className="flex gap-2">
                <button
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm ${
                    transferType === 'uk' 
                      ? 'border-[#2d6a7a] bg-[#2d6a7a] text-white' 
                      : 'border-gray-300 text-gray-700'
                  }`}
                  onClick={() => { setTransferType('uk'); setSelectedPayee(''); }}
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  UK Transfer
                </button>
                <button
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm ${
                    transferType === 'iban' 
                      ? 'border-[#2d6a7a] bg-[#2d6a7a] text-white' 
                      : 'border-gray-300 text-gray-700'
                  }`}
                  onClick={() => { setTransferType('iban'); setSelectedPayee(''); }}
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  IBAN Transfer
                </button>
              </div>
            </div>
            
            {/* From Account */}
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>From</p>
              <div className="relative">
                <select
                  value={selectedFromAccount}
                  onChange={(e) => setSelectedFromAccount(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg appearance-none bg-white text-gray-700 text-sm"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  <option value="">Select account</option>
                  {(accounts && Array.isArray(accounts)) && accounts.map(account => (
                    <option key={account.id} value={account.id.toString()}>
                      {account.displayName} ({account.accountNumber}) - {formatCurrency(account.balance, userCurrency)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            
            {/* To Payee */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>To</p>
              <div className="relative">
                <select
                  value={selectedPayee}
                  onChange={(e) => setSelectedPayee(e.target.value)}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg appearance-none bg-white text-gray-700 text-sm"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  <option value="">Select payee</option>
                  {payees
                    .filter(p => transferType === 'uk' ? p.transferType === 'UK Transfer' : p.transferType === 'SEPA Transfer')
                    .map((payee, idx) => (
                      <option key={idx} value={payee.name}>
                        {payee.name}
                      </option>
                    ))
                  }
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            
            {/* Continue Button */}
            <button
              className="w-full py-3 border border-gray-300 rounded-lg text-gray-500 text-sm"
              style={{ fontFamily: 'OpenSans, sans-serif' }}
              onClick={() => {
                if (selectedFromAccount && selectedPayee) {
                  const payee = payees.find(p => p.name === selectedPayee);
                  if (payee) {
                    // Store selected payee data for pre-filling the form (same as Recent Payees)
                    sessionStorage.setItem('selectedPayee', JSON.stringify(payee));
                    // Store selected account for pre-filling
                    sessionStorage.setItem('selectedFromAccount', selectedFromAccount);
                  }
                  if (transferType === 'uk') {
                    navigateWithAnimation(`/uk-transfer?from=${selectedFromAccount}`);
                  } else {
                    navigateWithAnimation(`/iban-transfer?from=${selectedFromAccount}`);
                  }
                }
              }}
            >
              Continue
            </button>
          </div>
        )}
        
        <div className="h-1 bg-gradient-to-r from-[#2d6a7a] to-[#4a9db0]"></div>
      </div>

      {/* Main content area - scrollable */}
      <div 
        ref={scrollContainerRef}
        className="main-scroll-container flex-1 px-0 overflow-y-auto ios-scroll" 
        data-scroll-container
        data-scroll-route="/dashboard"
      >
        <div className="bg-gray-50 h-full">
          <div className="pt-6 px-4 space-y-6" style={{ overscrollBehavior: 'contain' }}>
            {(accounts && Array.isArray(accounts)) && accounts.map((account, index) => {
              const isLoading = loadingAccountId === account.id;
              const isDisabled = loadingAccountId !== null || isNavigating;
              
              return (
                <button 
                  key={account.id}
                  className={`w-full flex items-center overflow-hidden bg-white shadow-sm border border-gray-200 touch-manipulation relative stagger-item android-no-highlight ${
                    isTouchDevice 
                      ? '' // No hover/pressed on touch devices
                      : 'hover:shadow-md transition-all duration-150 ease-out active:scale-98 card-interactive' // Desktop interactions
                  } ${
                    isDisabled ? 'opacity-50 pointer-events-none' : ''
                  }`}
                  onClick={isTouchDevice ? undefined : () => handleAccountTap(account.id)}
                  onTouchStart={isTouchDevice ? (e) => handleTouchStart(e, account.id) : undefined}
                  onTouchEnd={isTouchDevice ? (e) => handleTouchEnd(e, account.id) : undefined}
                  onTouchMove={isTouchDevice ? handleTouchMove : undefined}
                  disabled={isDisabled}
                  style={{ 
                    animationDelay: `${index * 0.1}s`,
                    WebkitTapHighlightColor: 'transparent',
                    outline: 'none'
                  }}
                  data-testid={`account-button-${account.id}`}
                >
                  {/* Colored side bar */}
                  <div className={`w-1 self-stretch ${getAccountColor(account.accountType)}`}></div>
                  
                  <div className="flex items-center justify-between w-full px-5 py-4">
                    <div className="text-left">
                      <p className="text-lg text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>{account.displayName}</p>
                      <p className="text-base text-gray-400 mt-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>~ {account.accountNumber.slice(-4)}</p>
                    </div>
                    <div className="flex items-center">
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 text-[#126987] animate-spin mr-3" data-testid={`loader-${account.id}`} />
                      ) : (
                        <>
                          <p className="text-xl text-[#2d6a7a]" style={{ fontFamily: 'OpenSans, sans-serif' }}>{formatCurrency(account.balance, userCurrency)}</p>
                          <ChevronRight className="h-5 w-5 ml-2 text-[#2d6a7a]" />
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            
            {/* Monthly Insights Section */}
            <button 
              onClick={() => navigateWithAnimation('/monthly-insights')}
              className="w-full bg-white shadow-sm border border-gray-200 p-4 mt-2 text-left"
            >
              <div className="flex items-center mb-2">
                <div className="w-2 h-2 rounded-full bg-[#2d6a7a] mr-2"></div>
                <span className="text-sm text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>{monthlyInsights.currentDate}</span>
              </div>
              <h3 className="text-lg font-medium text-gray-800 mb-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>Monthly money in and out</h3>
              <p className="text-sm text-gray-500 mb-4" style={{ fontFamily: 'OpenSans, sans-serif' }}>See what came in and went out of your account this month. Tap for details.</p>
              
              <div className="space-y-3">
                {/* Current Month Only */}
                <div className="flex items-center">
                  <span className="text-sm text-gray-700 w-10" style={{ fontFamily: 'OpenSans, sans-serif' }}>{monthlyInsights.currentMonth.name}</span>
                  <div className="flex-1 h-2 bg-gray-200 ml-2 overflow-hidden relative">
                    {monthlyInsights.currentMonth.moneyIn > 0 && (
                      <div 
                        className="absolute left-0 top-0 h-full bg-green-500" 
                        style={{ 
                          width: `${Math.min((monthlyInsights.currentMonth.moneyIn / Math.max(monthlyInsights.currentMonth.moneyIn + monthlyInsights.currentMonth.moneyOut, 1)) * 100, 100)}%` 
                        }}
                      ></div>
                    )}
                    {monthlyInsights.currentMonth.moneyOut > 0 && (
                      <div 
                        className="absolute top-0 h-full bg-red-400" 
                        style={{ 
                          left: `${(monthlyInsights.currentMonth.moneyIn / Math.max(monthlyInsights.currentMonth.moneyIn + monthlyInsights.currentMonth.moneyOut, 1)) * 100}%`,
                          width: `${Math.min((monthlyInsights.currentMonth.moneyOut / Math.max(monthlyInsights.currentMonth.moneyIn + monthlyInsights.currentMonth.moneyOut, 1)) * 100, 100)}%` 
                        }}
                      ></div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-end mt-3 space-x-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 mr-1"></div>
                  <span className="text-xs text-gray-500">In</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-400 mr-1"></div>
                  <span className="text-xs text-gray-500">Out</span>
                </div>
              </div>
            </button>
            
            {/* See more insights button */}
            <button 
              onClick={() => navigateWithAnimation('/monthly-insights')}
              className="w-full py-3 bg-[#126987] text-white text-center mb-6"
              style={{ fontFamily: 'OpenSans, sans-serif' }}
            >
              See more insights
            </button>
          </div>
        </div>
      </div>


    </div>
  );
}