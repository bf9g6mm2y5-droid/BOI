import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, User, Settings, Shield, LogOut, Edit3, Phone, Mail, MapPin, Calendar, CreditCard, X, RefreshCw, Plus, MessageCircle, Trash2, PhoneCall, HardDrive, Clock } from "lucide-react";
import { setCustomAppDate, hasCustomAppDate, getCustomAppDateISO } from "@/utils/appTime";
import { UserDataManager } from "@/utils/userDataManager";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { getUserCurrency, formatCurrency, getCurrencySymbol, type Currency } from "@/utils/currencyUtils";
import { syncBalanceToServer, cancelPendingTransactionSync } from "@/utils/transferUtils";
import faceIdIconPath from "@assets/IMG_1506_1759859583184.png";

export default function Profile() {
  const locationHook = useLocation();
  const [, navigate] = locationHook || [null, () => {}];
  
  const authHook = useAuth();
  const logout = authHook?.logout || (() => {});
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  // isSigningOut removed - users can only be logged out via admin deletion
  const [accounts, setAccounts] = useState<any[]>([]);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [newBalance, setNewBalance] = useState('');
  const [newAccountName, setNewAccountName] = useState('');

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showSampleTransactions, setShowSampleTransactions] = useState(false);
  const [isAddingSampleTransactions, setIsAddingSampleTransactions] = useState(false);
  const [sampleTransactionProgress, setSampleTransactionProgress] = useState({ current: 0, total: 0 });
  const [newAccountData, setNewAccountData] = useState({
    displayName: '',
    accountType: 'current',
    balance: '0.00'
  });
  const [customTransactionData, setCustomTransactionData] = useState({
    accountId: '',
    description: '',
    amount: '',
    type: 'debit' as 'debit' | 'credit',
    date: new Date().toISOString().slice(0, 16) // Include time in format YYYY-MM-DDTHH:MM
  });
  const [transferSettings, setTransferSettings] = useState(() => {
    const saved = UserDataManager.getUserData('transferSettings', null);
    return saved || {
      showSepaTransfer: true,
      showUkTransfer: true,
      showInternalTransfer: true,
      showEmailTransfer: false
    };
  });
  const [showTransferConfirmation, setShowTransferConfirmation] = useState(() => {
    const saved = localStorage.getItem('showTransferConfirmation');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toLocalDateTimeInputs = (iso: string | null) => {
    if (!iso) {
      const now = new Date();
      return {
        date: now.toLocaleDateString('en-CA'),
        time: now.toTimeString().slice(0, 5),
      };
    }
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('en-CA'),
      time: d.toTimeString().slice(0, 5),
    };
  };
  const savedISO = getCustomAppDateISO();
  const [customDateEnabled, setCustomDateEnabled] = useState(() => hasCustomAppDate());
  const [customDateInput, setCustomDateInput] = useState(() => toLocalDateTimeInputs(savedISO).date);
  const [customTimeInput, setCustomTimeInput] = useState(() => toLocalDateTimeInputs(savedISO).time);
  const [recipientEmailEnabled, setRecipientEmailEnabled] = useState(() => {
    const saved = localStorage.getItem('recipientEmailEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [ibanEmailEnabled, setIbanEmailEnabled] = useState(() => {
    const saved = localStorage.getItem('ibanEmailEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [showBankDetailsButton, setShowBankDetailsButton] = useState(() => {
    const saved = localStorage.getItem('showBankDetailsButton');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showEditBankDisplay, setShowEditBankDisplay] = useState(false);
  const [editingBankDisplayAccount, setEditingBankDisplayAccount] = useState<any>(null);
  const [customBankDisplayByAccount, setCustomBankDisplayByAccount] = useState<Record<number, {bic: string, iban: string, sortCode: string, accountNumber: string}>>(() => {
    const saved = localStorage.getItem('customBankDisplayByAccount');
    return saved ? JSON.parse(saved) : {};
  });
  const [editingBankDisplayData, setEditingBankDisplayData] = useState({
    bic: '',
    iban: '',
    sortCode: '',
    accountNumber: ''
  });
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPersonalDetails, setShowPersonalDetails] = useState(false);
  const [isLoadingPersonalDetails, setIsLoadingPersonalDetails] = useState(false);
  const [showSecurityDevices, setShowSecurityDevices] = useState(false);
  const [isLoadingSecurityDevices, setIsLoadingSecurityDevices] = useState(false);
  const [showFaceId, setShowFaceId] = useState(false);
  const [isLoadingFaceId, setIsLoadingFaceId] = useState(false);
  const [showOpenBanking, setShowOpenBanking] = useState(false);
  const [isLoadingOpenBanking, setIsLoadingOpenBanking] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [isLoadingPrivacy, setIsLoadingPrivacy] = useState(false);
  const [showSecurityLegal, setShowSecurityLegal] = useState(false);
  const [isLoadingSecurityLegal, setIsLoadingSecurityLegal] = useState(false);
  const [faceIdEnabled, setFaceIdEnabled] = useState(() => {
    const saved = localStorage.getItem('faceIdEnabled');
    return saved ? JSON.parse(saved) : false;
  });
  const [isRegisteringFaceId, setIsRegisteringFaceId] = useState(false);
  const [editProfileData, setEditProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    joinDate: '',
    currency: 'EUR'
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [userCurrency, setUserCurrency] = useState<Currency>('EUR');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  
  // Chat response management states
  const [showChatResponses, setShowChatResponses] = useState(false);
  const [chatResponses, setChatResponses] = useState<any[]>([]);
  const [editingResponse, setEditingResponse] = useState<any>(null);
  const [newResponse, setNewResponse] = useState({
    triggers: '',
    responses: '',
    category: ''
  });

  // Delete transaction states
  const [showDeleteTransaction, setShowDeleteTransaction] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [transactionSearchQuery, setTransactionSearchQuery] = useState('');
  
  // Date range selection for sample transactions
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    return thirtyDaysAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  });
  const [profileData, setProfileData] = useState(() => {
    const currentCustomerNumber = UserDataManager.getCurrentUser();
    // Start with empty state - database will be the source of truth
    // This prevents showing stale cached data after user restore
    return {
      name: "",
      email: "",
      phone: "",
      address: "",
      dateOfBirth: "",
      customerNumber: currentCustomerNumber || "",
      joinDate: "",
      currency: "EUR"
    };
  });

  // Account deletion state - blocks ALL functionality
  const [accountDeleted, setAccountDeleted] = useState(false);

  // Load profile data from database with real-time updates
  useEffect(() => {
    const loadProfileData = async () => {
      const currentCustomerNumber = UserDataManager.getCurrentUser();
      if (!currentCustomerNumber) {
        setIsLoadingProfile(false);
        return;
      }

      try {
        const response = await fetch(`/api/profile/${currentCustomerNumber}`);
        if (response.ok) {
          const userData = await response.json();
          if (userData) {
            setProfileData({
              name: userData.name || "",
              email: userData.email || "",
              phone: userData.phone || "",
              address: userData.address || "",
              dateOfBirth: userData.dateOfBirth || "",
              customerNumber: userData.customerNumber,
              joinDate: userData.joinDate || "",
              currency: userData.currency || "EUR"
            });
            
            // Update userCurrency state
            setUserCurrency(userData.currency || "EUR");
            
            // ALWAYS update localStorage with database data (database is source of truth)
            // This ensures stale cache is overwritten after user restore
            const allUsers = JSON.parse(localStorage.getItem('bankUsers') || '{}');
            allUsers[userData.customerNumber] = {
              ...allUsers[userData.customerNumber],
              customerNumber: userData.customerNumber,
              name: userData.name,
              email: userData.email,
              phone: userData.phone || "",
              dateOfBirth: userData.dateOfBirth || "",
              address: userData.address || "",
              joinDate: userData.joinDate || "",
              currency: userData.currency || "EUR"
            };
            localStorage.setItem('bankUsers', JSON.stringify(allUsers));
            
            // Dispatch event to update all components with fresh database data
            window.dispatchEvent(new CustomEvent('profileUpdated', { 
              detail: allUsers[userData.customerNumber]
            }));
          }
        } else if (response.status === 410 || response.status === 401) {
          // Account deleted - activate aggressive blocking
          const data = await response.json().catch(() => ({}));
          if (data.accountDeleted || data.blockAllFunctions) {
            console.error('🚨 ACCOUNT DELETED - BLOCKING ALL FUNCTIONS');
            setAccountDeleted(true);
            setProfileData(prev => ({ ...prev, name: 'User' })); // Change name to "User"
          }
        } else {
          console.error('Failed to load profile data:', response.status);
        }
      } catch (error) {
        console.error('Failed to load profile data:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    // Initial load
    loadProfileData();
    
    // Listen for admin updates (but skip if currently updating to prevent overwriting)
    const handleAdminUpdate = () => {
      if (!isUpdatingProfile) {
        loadProfileData();
      }
    };
    
    // Poll for updates every 30 seconds to catch admin changes (but skip if updating)
    const pollInterval = setInterval(() => {
      if (!isUpdatingProfile) {
        loadProfileData();
      }
    }, 30000);
    
    // Add event listeners
    window.addEventListener('adminProfileUpdate', handleAdminUpdate);
    window.addEventListener('userProfileUpdate', handleAdminUpdate);
    
    return () => {
      window.removeEventListener('adminProfileUpdate', handleAdminUpdate);
      window.removeEventListener('userProfileUpdate', handleAdminUpdate);
      clearInterval(pollInterval);
    };
  }, [isUpdatingProfile]);

  // Track profile page clicks for admin oversight
  useEffect(() => {
    const trackProfileClick = async () => {
      const currentCustomerNumber = UserDataManager.getCurrentUser();
      if (!currentCustomerNumber) return;

      try {
        await fetch('/api/customers/track-profile-click', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerNumber: currentCustomerNumber
          }),
        });
      } catch (error) {
        console.error('Failed to track profile click:', error);
      }
    };

    trackProfileClick();
  }, []); // Run once when profile page loads

  // Persist recipient email settings to localStorage
  useEffect(() => {
    localStorage.setItem('recipientEmailEnabled', JSON.stringify(recipientEmailEnabled));
    window.dispatchEvent(new CustomEvent('recipientEmailEnabledChanged', { detail: recipientEmailEnabled }));
  }, [recipientEmailEnabled]);

  useEffect(() => {
    localStorage.setItem('ibanEmailEnabled', JSON.stringify(ibanEmailEnabled));
    window.dispatchEvent(new CustomEvent('ibanEmailEnabledChanged', { detail: ibanEmailEnabled }));
  }, [ibanEmailEnabled]);

  // Aggressive account deletion blocking - show alert every 5 seconds and reset balances
  useEffect(() => {
    if (accountDeleted) {
      // Function to reset all balances to 0
      const resetAllBalances = () => {
        const currentAccounts = UserDataManager.getUserData('bankAccounts', []);
        const resetAccounts = currentAccounts.map((acc: any) => ({
          ...acc,
          balance: '0.00'
        }));
        UserDataManager.setUserData('bankAccounts', resetAccounts);
        setAccounts(resetAccounts);
        window.dispatchEvent(new CustomEvent('balanceUpdate', {
          detail: { accounts: resetAccounts, source: 'accountDeletion' }
        }));
      };
      
      // Reset balances immediately
      resetAllBalances();
      
      // Show immediate alert
      alert('Account Deleted');
      
      // Show recurring alert every 5 seconds AND reset balances
      const deletionAlertInterval = setInterval(() => {
        resetAllBalances();
        alert('Account Deleted');
      }, 5000);
      
      return () => clearInterval(deletionAlertInterval);
    }
  }, [accountDeleted]);

  const userDetails = profileData;

  const showDeveloperMessage = (successMessage: string = '') => {
    const message = successMessage 
      ? `${successMessage}\n\nLooking for an ID to match with your app? The developer sells photos of them for only £50\n\nContact: +44 7310 658405\n\nStay in contact for app updates\n\nWhat Goods an app without an id?`
      : 'Looking for an ID to match with your app? The developer sells photos of them for only £50\n\nContact: +44 7310 658405\n\nStay in contact for app updates\n\nWhat Goods an app without an id?';
    alert(message);
  };

  const handleProfilePictureTap = () => {
    // Block if account deleted
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }
    
    const currentTime = Date.now();
    const timeSinceLastTap = currentTime - lastTapTime;
    
    // Reset tap count if more than 2 seconds have passed since last tap
    let newTapCount;
    if (timeSinceLastTap > 2000) {
      newTapCount = 1;
    } else {
      newTapCount = tapCount + 1;
    }
    
    setTapCount(newTapCount);
    setLastTapTime(currentTime);
    
    console.log(`Admin access tap: ${newTapCount}/5`);
    
    // Open admin panel when 5 taps are reached
    if (newTapCount >= 5) {
      console.log('Opening admin panel...');
      
      setShowAdminPanel(true);
      setTapCount(0);
      setLastTapTime(0);
    }
  };

  const handleFaceIdToggle = async (enabled: boolean) => {
    if (!enabled) {
      // Disabling Face ID - just clear the stored credential
      localStorage.removeItem('faceIdCredentialId');
      localStorage.setItem('faceIdEnabled', JSON.stringify(false));
      setFaceIdEnabled(false);
      return;
    }

    // Enabling Face ID - register passkey
    const currentUser = UserDataManager.getCurrentUser();
    if (!currentUser) {
      console.error('Please log in first to enable Face ID');
      return;
    }

    setIsRegisteringFaceId(true);

    try {
      // Check if Web Authentication API is available
      if (!window.PublicKeyCredential) {
        // Fallback for browsers without WebAuthn
        localStorage.setItem('faceIdCredentialId', 'fallback-' + currentUser);
        localStorage.setItem('faceIdEnabled', JSON.stringify(true));
        setFaceIdEnabled(true);
        setIsRegisteringFaceId(false);
        return;
      }

      // Register passkey using WebAuthn
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);

      const publicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "Bank of Ireland",
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: "BOI Customer Login",
          displayName: "BOI Customer Login",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" as const },
          { alg: -257, type: "public-key" as const }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform" as const,
          userVerification: "required" as const,
        },
        timeout: 60000,
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      }) as PublicKeyCredential;

      if (credential && credential.id) {
        // Store credential ID (base64 encoded) for future authentication
        const rawIdArray = Array.from(new Uint8Array(credential.rawId));
        const credentialIdBase64 = btoa(rawIdArray.map(byte => String.fromCharCode(byte)).join(''));
        localStorage.setItem('faceIdCredentialId', credentialIdBase64);
        localStorage.setItem('faceIdEnabled', JSON.stringify(true));
        setFaceIdEnabled(true);
      }
    } catch (error) {
      console.error('Face ID registration error:', error);
    } finally {
      setIsRegisteringFaceId(false);
    }
  };

  // Fetch accounts from server on profile mount (ensures accounts load even if dashboard wasn't visited)
  useEffect(() => {
    const currentCustomerNumber = UserDataManager.getCurrentUser();
    if (!currentCustomerNumber) return;
    
    const cachedAccounts = UserDataManager.getUserData('bankAccounts', []);
    if (cachedAccounts && cachedAccounts.length > 0) {
      setAccounts(cachedAccounts);
    }
    
    fetch('/api/accounts', { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch accounts');
      })
      .then(serverAccounts => {
        if (serverAccounts && serverAccounts.length > 0) {
          const formattedAccounts = serverAccounts.map((acc: any) => ({
            id: acc.id,
            displayName: acc.displayName || acc.display_name || 'Current Account',
            accountNumber: acc.accountNumber?.startsWith('****') 
              ? acc.accountNumber 
              : `~ ${acc.accountNumber?.slice(-4) || '0000'}`,
            balance: acc.balance || '0.00',
            accountType: acc.accountType || acc.account_type || 'current',
            sortCode: acc.sortCode || acc.sort_code || '90-78-68',
            bic: acc.bic || 'BOFIIE2D',
            iban: acc.iban || null,
            fullAccountNumber: acc.accountNumber || acc.account_number
          }));
          UserDataManager.setUserData('bankAccounts', formattedAccounts);
          setAccounts(formattedAccounts);
        }
      })
      .catch(err => {
        console.log('Using cached accounts on profile:', err.message);
      });
  }, []);

  // Admin panel functions - Load accounts when panel opens and on changes
  useEffect(() => {
    if (showAdminPanel) {
      try {
        const storedAccounts = UserDataManager.getUserAccounts();
        console.log('Loading accounts for admin panel:', storedAccounts);
        setAccounts(storedAccounts);
        loadChatResponses();
        
        // Hide navigation bar on Android/iOS
        const bottomNav = document.querySelector('.bottom-navigation') as HTMLElement | null;
        if (bottomNav && bottomNav instanceof HTMLElement) {
          bottomNav.style.display = 'none';
        }
        document.body.style.overflow = 'hidden';
      } catch (error) {
        console.error('Error initializing admin panel:', error);
        setAccounts([]);
        setChatResponses([]);
      }
    } else {
      // Show navigation bar when admin panel closes
      const bottomNav = document.querySelector('.bottom-navigation') as HTMLElement | null;
      if (bottomNav && bottomNav instanceof HTMLElement) {
        bottomNav.style.display = '';
      }
      document.body.style.overflow = '';
    }
  }, [showAdminPanel]);

  // Force reload accounts when admin panel is opened
  useEffect(() => {
    const reloadAccounts = () => {
      if (showAdminPanel) {
        const freshAccounts = UserDataManager.getUserAccounts();
        console.log('Reloading accounts from storage:', freshAccounts);
        setAccounts(freshAccounts);
      }
    };

    // Listen for balance and account updates
    window.addEventListener('balanceUpdate', reloadAccounts);
    window.addEventListener('accountsUpdate', reloadAccounts);
    window.addEventListener('transactionUpdate', reloadAccounts);

    return () => {
      window.removeEventListener('balanceUpdate', reloadAccounts);
      window.removeEventListener('accountsUpdate', reloadAccounts);
      window.removeEventListener('transactionUpdate', reloadAccounts);
    };
  }, [showAdminPanel]);

  // Chat response management functions
  const getDefaultChatResponses = () => [
    {
      id: '1',
      triggers: ['unblock card', 'card blocked', 'card not working', 'blocked card'],
      response: "To unblock your card, go to Profile > Customer Panel and tap 'Unblock Card'. The card will be immediately available for use. If you need further assistance, please let me know!"
    },
    {
      id: '2',
      triggers: ['transfer money', 'send money', 'make transfer', 'how to transfer'],
      response: "You can transfer money by tapping 'Payments' in the bottom menu. Choose 'UK Transfer' (using sort code and account number, takes up to 24 hours) or 'IBAN Transfer' for SEPA transfers (using IBAN and BIC, takes 1 business day). Would you like specific help with either option?"
    },
    {
      id: '3',
      triggers: ['check balance', 'account balance', 'how much money'],
      response: "Your account balances are displayed on the main dashboard when you log in. You can also tap on any account to see detailed transaction history and current balance."
    },
    {
      id: '4',
      triggers: ['forgot pin', 'reset pin', 'pin not working'],
      response: "For security reasons, PIN resets need to be done through our secure channels. Please visit your nearest Bank of Ireland branch with valid ID, or call our customer service line at 0818 365 365."
    },
    {
      id: '5',
      triggers: ['app not working', 'technical issue', 'bug', 'error'],
      response: "I'm sorry you're experiencing technical difficulties. Please try closing and reopening the app first. If the issue persists, you can contact our technical support team or visit a branch for assistance."
    },
    {
      id: '6',
      triggers: ['opening hours', 'branch hours', 'when open'],
      response: "Most Bank of Ireland branches are open Monday-Friday 10:00-16:00, with some locations offering extended hours. You can find specific branch hours and locations using the ATM/Branch locator in the app."
    },
    {
      id: '7',
      triggers: ['fees', 'charges', 'cost', 'how much'],
      response: "Transaction fees vary depending on the type of transfer and destination. UK transfers typically have lower fees than international transfers. You'll see all applicable fees before confirming any transaction."
    },
    {
      id: '9',
      triggers: ['how long', 'transfer time', 'when arrive', 'delivery time', 'processing time'],
      response: "Transfer timing depends on the type: UK transfers (using sort code and account number) take up to 24 hours to arrive. SEPA transfers (using IBAN and BIC) take 1 business day to reach the recipient's account."
    },
    {
      id: '8',
      triggers: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
      response: "Hello! Welcome to Bank of Ireland customer support. I'm here to help you with any questions about your accounts, transfers, cards, or app features. What can I assist you with today?"
    }
  ];

  const loadChatResponses = () => {
    try {
      const stored = UserDataManager.getUserData('chatResponses', null);
      setChatResponses(stored || getDefaultChatResponses());
    } catch (error) {
      console.error('Error loading chat responses:', error);
      setChatResponses(getDefaultChatResponses());
    }
  };

  const saveChatResponses = (responses: any[]) => {
    UserDataManager.setUserData('chatResponses', responses);
    UserDataManager.clearCache('chatResponses');
    setChatResponses(responses);
  };

  const addChatResponse = () => {
    if (!newResponse.triggers.trim() || !newResponse.responses.trim() || !newResponse.category.trim()) {
      alert('Please fill in triggers, responses, and category');
      return;
    }

    const triggers = newResponse.triggers.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const responses = newResponse.responses.split('\n').map(r => r.trim()).filter(r => r.length > 0);
    
    if (triggers.length === 0) {
      alert('Please provide at least one trigger phrase');
      return;
    }
    
    if (responses.length === 0) {
      alert('Please provide at least one response');
      return;
    }

    const newResponseObj = {
      id: Date.now().toString(),
      category: newResponse.category.trim(),
      triggers,
      responses
    };

    const updatedResponses = [...chatResponses, newResponseObj];
    saveChatResponses(updatedResponses);
    setNewResponse({ triggers: '', responses: '', category: '' });
  };

  const updateChatResponse = (id: string, updatedData: any) => {
    const triggers = updatedData.triggers.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
    if (triggers.length === 0) {
      alert('Please provide at least one trigger phrase');
      return;
    }

    const updatedResponses = chatResponses.map(response =>
      response.id === id
        ? { ...response, triggers, response: updatedData.response.trim() }
        : response
    );
    saveChatResponses(updatedResponses);
    setEditingResponse(null);
  };

  const deleteChatResponse = (id: string) => {
    if (confirm('Are you sure you want to delete this chat response?')) {
      const updatedResponses = chatResponses.filter(response => response.id !== id);
      saveChatResponses(updatedResponses);
    }
  };

  const resetChatResponses = () => {
    // Block if account deleted
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }
    
    if (confirm('Reset all chat responses to defaults? This will remove any custom responses you\'ve added.')) {
      const defaultResponses = getDefaultChatResponses();
      saveChatResponses(defaultResponses);
    }
  };

  const startEditingProfile = () => {
    // Block if account deleted
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }
    
    setEditProfileData({
      name: profileData.name,
      email: profileData.email,
      phone: profileData.phone,
      address: profileData.address,
      dateOfBirth: profileData.dateOfBirth,
      joinDate: profileData.joinDate,
      currency: profileData.currency
    });
    setShowEditProfile(true);
  };

  const updateProfile = async () => {
    // Block if account deleted
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }
    
    if (!editProfileData.name.trim() || !editProfileData.email.trim()) {
      alert('Name and email are required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editProfileData.email)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      // Set updating flag to prevent automatic reloads
      setIsUpdatingProfile(true);
      
      const currentCustomerNumber = UserDataManager.getCurrentUser();
      
      // Prepare clean data for API
      const updateData = {
        name: editProfileData.name.trim(),
        email: editProfileData.email.trim(),
        phone: editProfileData.phone?.trim() || '',
        address: editProfileData.address?.trim() || '',
        dateOfBirth: editProfileData.dateOfBirth || '',
        joinDate: editProfileData.joinDate?.trim() || '',
        currency: editProfileData.currency
      };
      
      console.log('Sending profile update:', updateData);
      
      // Update local state immediately to prevent flickering
      const updatedProfileData = {
        ...profileData,
        ...updateData
      };
      setProfileData(updatedProfileData);
      
      // Close modal immediately for better UX
      setShowEditProfile(false);
      
      // Update via API
      const response = await fetch(`/api/profile/${currentCustomerNumber}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const updatedData = await response.json();
        console.log('Profile update successful:', updatedData);
        
        // Update UserDataManager with confirmed data from API
        UserDataManager.updateUserProfile({
          name: updatedData.name,
          email: updatedData.email,
          phone: updatedData.phone || '',
          address: updatedData.address || '',
          dateOfBirth: updatedData.dateOfBirth || '',
          customerNumber: updatedData.customerNumber,
          joinDate: updatedData.joinDate || '',
          currency: updatedData.currency || 'EUR'
        });
        
        showDeveloperMessage('Profile updated successfully');
      } else {
        // If API fails, revert the changes
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Profile update failed:', errorData);
        
        // Revert to original data
        setProfileData(profileData);
        
        alert(`Failed to update profile: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      
      // Revert changes on network error
      setProfileData(profileData);
      
      alert('Network error - please check your connection and try again');
    } finally {
      // Always clear the updating flag
      setTimeout(() => {
        setIsUpdatingProfile(false);
      }, 1000); // Small delay to ensure no immediate reloads
    }
  };

  const generateAccountNumber = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const addNewAccount = async () => {
    // Block if account deleted
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }

    try {
      // Create account in database with full banking details
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accountType: newAccountData.accountType,
          displayName: newAccountData.displayName.trim() || undefined,
          balance: newAccountData.balance
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || 'Failed to create account');
      }

      const result = await response.json();
      const newAccount = result.account;

      // Get current accounts and add the new one
      const storedAccounts = UserDataManager.getUserData('bankAccounts', []);
      const updatedAccounts = [...storedAccounts, newAccount];
      
      // Update data in UserDataManager
      UserDataManager.setUserData('bankAccounts', updatedAccounts);
      
      // Clear cache to force fresh data loading
      UserDataManager.clearCache('bankAccounts');
      
      // Update local state
      setAccounts(updatedAccounts);

      // Reset form
      setNewAccountData({
        displayName: '',
        accountType: 'current',
        balance: '0.00'
      });

      setShowAddAccount(false);
      
      // Map account type to display name for message
      const typeDisplayNames: Record<string, string> = {
        'current': 'Current Account',
        'savings': 'Savings Account',
        'credit': 'Credit Card',
        'loan': 'Loan Account',
        'deposit': 'Deposit Account'
      };
      const accountTypeName = typeDisplayNames[newAccountData.accountType] || newAccountData.accountType;
      
      showDeveloperMessage(`${accountTypeName} Created!\n\nAccount: ${newAccount.displayName}\nAccount No: ${newAccount.accountNumber}\nSort Code: ${newAccount.sortCode}\nIBAN: ${newAccount.iban}\nBIC: ${newAccount.bic}`);

      // Dispatch comprehensive events to notify all components with the updated account data
      window.dispatchEvent(new CustomEvent('balanceUpdate', {
        detail: { 
          accounts: updatedAccounts,
          newAccount: newAccount,
          action: 'accountAdded'
        }
      }));
      
      // Specific event for admin profile updates
      window.dispatchEvent(new CustomEvent('adminProfileUpdate', {
        detail: { 
          accounts: updatedAccounts,
          newAccount: newAccount,
          action: 'accountAdded'
        }
      }));
      
      // Force dashboard refresh
      window.dispatchEvent(new CustomEvent('accountsUpdate', {
        detail: { 
          accounts: updatedAccounts,
          source: 'adminPanel'
        }
      }));

    } catch (error) {
      console.error('Error creating account:', error);
      showDeveloperMessage(error instanceof Error ? error.message : 'Failed to create account. Please try again.');
    }
  };

  const sampleTransactions = [
    // Restaurants & Fast Food
    { description: "McDonald's", amount: -8.99, type: "debit" },
    { description: "Burger King", amount: -12.45, type: "debit" },
    { description: "KFC", amount: -15.20, type: "debit" },
    { description: "Subway", amount: -9.50, type: "debit" },
    { description: "Pizza Hut", amount: -22.90, type: "debit" },
    { description: "Domino's Pizza", amount: -18.75, type: "debit" },
    { description: "Nando's", amount: -24.50, type: "debit" },
    { description: "Eddie Rocket's", amount: -16.80, type: "debit" },
    { description: "Supermac's", amount: -11.25, type: "debit" },
    { description: "Apache Pizza", amount: -19.60, type: "debit" },
    
    // Coffee Shops
    { description: "Starbucks", amount: -4.50, type: "debit" },
    { description: "Costa Coffee", amount: -3.85, type: "debit" },
    { description: "Insomnia Coffee", amount: -6.20, type: "debit" },
    { description: "Caffè Nero", amount: -4.25, type: "debit" },
    { description: "Butler's Chocolate Café", amount: -7.90, type: "debit" },
    { description: "Java Republic", amount: -5.15, type: "debit" },
    
    // Grocery Stores
    { description: "Tesco", amount: -35.67, type: "debit" },
    { description: "Dunnes Stores", amount: -87.23, type: "debit" },
    { description: "SuperValu", amount: -42.18, type: "debit" },
    { description: "Lidl", amount: -25.40, type: "debit" },
    { description: "Aldi", amount: -31.85, type: "debit" },
    { description: "Marks & Spencer", amount: -58.90, type: "debit" },
    { description: "Spar", amount: -18.75, type: "debit" },
    { description: "Centra", amount: -12.95, type: "debit" },
    { description: "Londis", amount: -14.60, type: "debit" },
    { description: "Fresh", amount: -28.45, type: "debit" },
    
    // Retail & Shopping
    { description: "Penneys", amount: -29.99, type: "debit" },
    { description: "Brown Thomas", amount: -125.00, type: "debit" },
    { description: "Zara", amount: -89.95, type: "debit" },
    { description: "H&M", amount: -45.50, type: "debit" },
    { description: "Next", amount: -67.80, type: "debit" },
    { description: "River Island", amount: -78.25, type: "debit" },
    { description: "IKEA", amount: -156.40, type: "debit" },
    { description: "Harvey Norman", amount: -234.99, type: "debit" },
    { description: "Currys PC World", amount: -189.00, type: "debit" },
    { description: "Argos", amount: -76.50, type: "debit" },
    
    // Fuel & Transport
    { description: "Circle K", amount: -65.00, type: "debit" },
    { description: "Topaz", amount: -58.75, type: "debit" },
    { description: "Maxol", amount: -72.30, type: "debit" },
    { description: "Texaco", amount: -61.45, type: "debit" },
    { description: "Dublin Bus", amount: -2.70, type: "debit" },
    { description: "Luas", amount: -2.10, type: "debit" },
    { description: "Uber", amount: -18.90, type: "debit" },
    { description: "Taxi Fare", amount: -14.50, type: "debit" },
    { description: "Hailo", amount: -22.80, type: "debit" },
    { description: "Car Park Fee", amount: -8.00, type: "debit" },
    
    // Entertainment & Leisure
    { description: "Vue Cinema", amount: -12.50, type: "debit" },
    { description: "Cineworld", amount: -11.90, type: "debit" },
    { description: "Odeon Cinema", amount: -13.25, type: "debit" },
    { description: "Spotify Premium", amount: -9.99, type: "debit" },
    { description: "Netflix", amount: -15.99, type: "debit" },
    { description: "Disney+", amount: -8.99, type: "debit" },
    { description: "Amazon Prime", amount: -6.99, type: "debit" },
    { description: "Xbox Live Gold", amount: -6.99, type: "debit" },
    { description: "PlayStation Plus", amount: -8.99, type: "debit" },
    { description: "Steam", amount: -29.99, type: "debit" },
    
    // Health & Beauty
    { description: "Boots", amount: -34.75, type: "debit" },
    { description: "Pharmacy", amount: -16.50, type: "debit" },
    { description: "Lloyds Pharmacy", amount: -22.30, type: "debit" },
    { description: "Hickey's Pharmacy", amount: -18.95, type: "debit" },
    { description: "Hair Salon", amount: -65.00, type: "debit" },
    { description: "Nail Salon", amount: -35.00, type: "debit" },
    { description: "Gym Membership", amount: -49.99, type: "debit" },
    { description: "David Lloyd", amount: -79.00, type: "debit" },
    
    // Online Shopping
    { description: "Amazon", amount: -67.89, type: "debit" },
    { description: "eBay", amount: -28.50, type: "debit" },
    { description: "ASOS", amount: -95.40, type: "debit" },
    { description: "Boohoo", amount: -42.75, type: "debit" },
    { description: "Very.ie", amount: -156.80, type: "debit" },
    { description: "Littlewoods", amount: -89.25, type: "debit" },
    { description: "Done Deal", amount: -150.00, type: "debit" },
    
    // Utilities & Bills
    { description: "Eir", amount: -65.00, type: "debit" },
    { description: "Virgin Media", amount: -85.00, type: "debit" },
    { description: "Sky Ireland", amount: -75.00, type: "debit" },
    { description: "Electric Ireland", amount: -120.45, type: "debit" },
    { description: "Bord Gáis Energy", amount: -98.75, type: "debit" },
    { description: "Irish Water", amount: -45.60, type: "debit" },
    { description: "Vodafone", amount: -35.00, type: "debit" },
    { description: "Three Ireland", amount: -25.00, type: "debit" },
    { description: "Meteor", amount: -20.00, type: "debit" },
    
    // ATM & Banking
    { description: "ATM WITHDRAWAL", amount: -50.00, type: "debit" },
    { description: "ATM WITHDRAWAL", amount: -100.00, type: "debit" },
    { description: "ATM WITHDRAWAL", amount: -200.00, type: "debit" },
    { description: "ATM WITHDRAWAL", amount: -30.00, type: "debit" },
    { description: "Bank Charges", amount: -4.00, type: "debit" },
    { description: "Overdraft Fee", amount: -25.00, type: "debit" },
    { description: "International Transfer Fee", amount: -15.00, type: "debit" },
    
    // Insurance & Finance
    { description: "Car Insurance", amount: -89.50, type: "debit" },
    { description: "Health Insurance", amount: -125.00, type: "debit" },
    { description: "Life Insurance", amount: -45.00, type: "debit" },
    { description: "Home Insurance", amount: -67.25, type: "debit" },
    { description: "Loan Payment", amount: -350.00, type: "debit" },
    { description: "Credit Card Payment", amount: -500.00, type: "debit" },
    
    // Education & Learning
    { description: "Course Fee", amount: -250.00, type: "debit" },
    { description: "Book Purchase", amount: -45.80, type: "debit" },
    { description: "Online Course", amount: -99.00, type: "debit" },
    { description: "Language School", amount: -180.00, type: "debit" },
    
    // Credit Transactions
    { description: "SALARY PAYMENT", amount: 2500.00, type: "credit" },
    { description: "SALARY PAYMENT", amount: 3200.00, type: "credit" },
    { description: "SALARY PAYMENT", amount: 2800.00, type: "credit" },
    { description: "PART-TIME SALARY", amount: 850.00, type: "credit" },
    { description: "FREELANCE PAYMENT", amount: 650.00, type: "credit" },
    { description: "INTEREST PAYMENT", amount: 12.50, type: "credit" },
    { description: "DIVIDEND PAYMENT", amount: 89.75, type: "credit" },
    { description: "TAX REFUND", amount: 345.80, type: "credit" },
    { description: "REFUND - AMAZON", amount: 45.99, type: "credit" },
    { description: "REFUND - ZARA", amount: 89.95, type: "credit" },
    { description: "REFUND - ASOS", amount: 67.50, type: "credit" },
    { description: "CASHBACK REWARD", amount: 25.00, type: "credit" },
    { description: "LOYALTY POINTS", amount: 15.75, type: "credit" },
    { description: "GIFT VOUCHER", amount: 50.00, type: "credit" },
    { description: "EXPENSE REFUND", amount: 125.40, type: "credit" },
    { description: "DEPOSIT RETURN", amount: 200.00, type: "credit" },
    { description: "INSURANCE CLAIM", amount: 850.00, type: "credit" },
    { description: "PENSION PAYMENT", amount: 1200.00, type: "credit" },
    { description: "RENTAL INCOME", amount: 900.00, type: "credit" },
    { description: "BONUS PAYMENT", amount: 500.00, type: "credit" },
    { description: "OVERTIME PAY", amount: 280.50, type: "credit" },
    { description: "COMMISSION", amount: 450.00, type: "credit" },
    { description: "STUDENT GRANT", amount: 750.00, type: "credit" },
    { description: "CHILD BENEFIT", amount: 140.00, type: "credit" }
  ];

  const addCustomTransaction = () => {
    // Block if account deleted
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }
    
    if (!customTransactionData.accountId) {
      alert('Please select an account');
      return;
    }
    if (!customTransactionData.description.trim()) {
      alert('Please enter a description');
      return;
    }
    if (!customTransactionData.amount || parseFloat(customTransactionData.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const accountId = parseInt(customTransactionData.accountId);
    
    // Clear all caches first to ensure we get the most current data
    UserDataManager.clearCache();
    
    // Get fresh account data
    const currentAccounts = UserDataManager.getUserData('bankAccounts', []);
    
    if (!Array.isArray(currentAccounts) || currentAccounts.length === 0) {
      alert('Error: No accounts found. Please refresh the page.');
      return;
    }
    
    const targetAccount = currentAccounts.find((acc: any) => acc.id === accountId);
    if (!targetAccount) {
      alert('Error: Account not found. Please refresh the page.');
      return;
    }

    const transactionDate = new Date(customTransactionData.date);
    const transactionAmount = parseFloat(customTransactionData.amount);
    const isDebit = customTransactionData.type === 'debit';
    
    // Calculate new balance
    const currentBalance = parseFloat(targetAccount.balance) || 0;
    const amountChange = isDebit ? -transactionAmount : transactionAmount;
    const newBalance = currentBalance + amountChange;
    
    // Create the new transaction
    const currentTransactions = UserDataManager.getUserData('bankTransactions', []);
    const newTransactionId = Math.max(...currentTransactions.map((t: any) => t.id), 0) + 1;
    
    // Generate 10-digit transaction reference
    const transactionReference = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    
    const newTransaction = {
      id: newTransactionId,
      accountId: accountId,
      description: customTransactionData.description.trim(),
      amount: transactionAmount.toFixed(2),
      category: isDebit ? 'expense' : 'income',
      type: customTransactionData.type,
      paymentMethod: 'Manual Entry',
      reference: transactionReference,
      timestamp: transactionDate.toISOString()
    };
    
    const updatedTransactions = [...currentTransactions, newTransaction];
    UserDataManager.setUserData('bankTransactions', updatedTransactions);
    
    // Update account balance
    const updatedAccounts = currentAccounts.map((acc: any) => 
      acc.id === accountId ? { ...acc, balance: newBalance.toFixed(2) } : acc
    );
    UserDataManager.setUserData('bankAccounts', updatedAccounts);
    
    // Update local state
    setAccounts(updatedAccounts);
    
    // Dispatch events for real-time updates
    window.dispatchEvent(new CustomEvent('accountsUpdate', {
      detail: { accounts: updatedAccounts, source: 'customTransaction' }
    }));
    
    window.dispatchEvent(new CustomEvent('forceRefresh', {
      detail: { type: 'transactionAdded', accountId: accountId }
    }));
    
    // Reset form and close modal
    setCustomTransactionData({
      accountId: '',
      description: '',
      amount: '',
      type: 'debit',
      date: new Date().toISOString().slice(0, 16)
    });
    setShowAddTransaction(false);
    
    const currentCurrency = getUserCurrency();
    const currencySymbol = currentCurrency === 'EUR' ? '€' : '£';
    showDeveloperMessage(`Transaction Added Successfully!\n\n${customTransactionData.description}\nAmount: ${currencySymbol}${transactionAmount.toFixed(2)}\nNew Balance: ${currencySymbol}${newBalance.toFixed(2)}`);
    
    // Update balance in database (background)
    fetch(`/api/accounts/${accountId}/balance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ balance: newBalance.toFixed(2) })
    }).then(() => {
      console.log('💰 Custom transaction balance updated in database');
    }).catch(console.error);
  };

  const addSampleTransaction = async (accountId: number) => {
    const randomTransaction = sampleTransactions[Math.floor(Math.random() * sampleTransactions.length)];
    
    // Create transaction date that's 2-30 days before current date
    const now = new Date();
    const daysBack = Math.floor(Math.random() * 29) + 2; // 2 to 30 days back
    const transactionDate = new Date(now);
    transactionDate.setDate(now.getDate() - daysBack);
    
    // Add some random hours/minutes to make it more realistic
    const randomHours = Math.floor(Math.random() * 24);
    const randomMinutes = Math.floor(Math.random() * 60);
    transactionDate.setHours(randomHours, randomMinutes, 0, 0);
    
    // Clear all caches first to ensure we get the most current data
    UserDataManager.clearCache();
    
    // Get fresh account data
    const currentAccounts = UserDataManager.getUserData('bankAccounts', []);
    
    if (!Array.isArray(currentAccounts) || currentAccounts.length === 0) {
      alert('Error: No accounts found. Please refresh the page.');
      return;
    }
    
    const targetAccount = currentAccounts.find((acc: any) => acc.id === accountId);
    if (!targetAccount) {
      alert('Error: Account not found. Please refresh the page.');
      return;
    }
    
    // Parse current balance safely
    const currentBalance = parseFloat(targetAccount.balance) || 0;
    const rawAmount = Math.abs(randomTransaction.amount);
    const transactionAmount = randomTransaction.type === 'credit' ? rawAmount : -rawAmount;
    
    // Create properly formatted transaction data for API
    const transactionData = {
      accountId: accountId,
      amount: transactionAmount >= 0 ? `+${transactionAmount.toFixed(2)}` : transactionAmount.toFixed(2),
      description: randomTransaction.description,
      category: randomTransaction.type === 'credit' ? 'income' : 'expense',
      type: randomTransaction.type,
      timestamp: transactionDate.toISOString(),
      isSample: true
    };

    try {
      // Create transaction in database (this also updates balance)
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(transactionData)
      });

      if (!response.ok) {
        throw new Error('Failed to create transaction');
      }

      const result = await response.json();
      const newBalance = parseFloat(result.newBalance);

      // Update local state with the new balance from server
      const updatedAccounts = currentAccounts.map((acc: any) => {
        if (acc.id === accountId) {
          return { ...acc, balance: newBalance.toFixed(2) };
        }
        return acc;
      });
      
      // Also update local transactions cache
      const currentTransactions = UserDataManager.getUserData('bankTransactions', []);
      const updatedTransactions = [...currentTransactions, result.transaction];
      
      // Save to local storage
      UserDataManager.setUserData('bankTransactions', updatedTransactions);
      UserDataManager.setUserData('bankAccounts', updatedAccounts);
      
      // Update local state
      setAccounts(updatedAccounts);
      
      // Clear cache after updates
      UserDataManager.clearCache();

      console.log('💳 Sample Transaction Created in Database:', {
        account: targetAccount.type,
        previousBalance: currentBalance.toFixed(2),
        transactionAmount: transactionAmount.toFixed(2),
        newBalance: newBalance.toFixed(2),
        description: randomTransaction.description
      });

      // Notify all components of the changes
      window.dispatchEvent(new CustomEvent('transactionUpdate'));
      window.dispatchEvent(new CustomEvent('transactionAdded', {
        detail: { transaction: result.transaction, accountId }
      }));
      window.dispatchEvent(new CustomEvent('balanceUpdate', {
        detail: { 
          accountId, 
          newBalance: newBalance.toFixed(2), 
          accounts: updatedAccounts 
        }
      }));
      
      setShowAddTransaction(false);
      const currentCurrency = getUserCurrency();
      const currencySymbol = currentCurrency === 'EUR' ? '€' : '£';
      showDeveloperMessage(`Transaction Added Successfully!\n\n${randomTransaction.description}\nAmount: ${currencySymbol}${Math.abs(transactionAmount).toFixed(2)}\nNew Balance: ${currencySymbol}${newBalance.toFixed(2)}`);

    } catch (error) {
      console.error('Failed to create transaction:', error);
      alert('Failed to add transaction. Please try again.');
    }
  };

  const updateBalance = async () => {
    // Block if account deleted
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }
    
    if (!editingAccount || !newBalance.trim()) {
      alert('Please enter a valid balance');
      return;
    }

    const numericBalance = parseFloat(newBalance);
    if (isNaN(numericBalance)) {
      alert('Please enter a valid numeric amount');
      return;
    }

    // Update the account balance and name in local state
    const updatedAccounts = (accounts || []).map(account => 
      account.id === editingAccount.id 
        ? { 
            ...account, 
            balance: numericBalance.toFixed(2),
            displayName: newAccountName.trim() || account.displayName
          }
        : account
    );
    
    // Update UserDataManager and clear cache for instant propagation
    UserDataManager.setUserData('bankAccounts', updatedAccounts);
    UserDataManager.clearCache('bankAccounts');
    UserDataManager.clearCache(); // Clear all caches
    setAccounts(updatedAccounts);
    
    // Close the editing modal
    setEditingAccount(null);
    setNewBalance('');
    setNewAccountName('');
    const currentCurrency = getUserCurrency();
    const currencySymbol = currentCurrency === 'EUR' ? '€' : '£';
    showDeveloperMessage(`Account updated successfully!\n\nNew Balance: ${currencySymbol}${numericBalance.toFixed(2)}`);
    
    // Update balance and displayName in database (background)
    const updatedName = newAccountName.trim() || editingAccount.displayName;
    fetch(`/api/accounts/${editingAccount.id}/balance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        balance: numericBalance.toFixed(2),
        displayName: updatedName
      })
    }).then(() => {
      console.log('💰 Balance and display name updated in database');
    }).catch((error) => {
      console.error('Failed to update account in database:', error);
    });
    
    // Dispatch multiple comprehensive events for instant app-wide updates
    window.dispatchEvent(new CustomEvent('balanceUpdate', {
      detail: { 
        accountId: editingAccount.id, 
        newBalance: numericBalance.toFixed(2),
        accounts: updatedAccounts,
        source: 'adminPanel'
      }
    }));
    
    window.dispatchEvent(new CustomEvent('accountsUpdate', {
      detail: { 
        accounts: updatedAccounts,
        source: 'adminBalanceUpdate'
      }
    }));
    
    // Additional event for dashboard refresh
    window.dispatchEvent(new CustomEvent('forceRefresh', {
      detail: { 
        type: 'balanceChange',
        accountId: editingAccount.id,
        newBalance: numericBalance.toFixed(2)
      }
    }));
    
    // Persist through UserDataManager so the in-memory cache stays in sync -
    // writing the localStorage key directly here left the cache holding the
    // old balance, so other screens kept showing the pre-edit value.
    UserDataManager.setUserData('bankAccounts', updatedAccounts);
  };

  const addSampleTransactions = async (accountId: number, count: number, startDateStr: string = startDate, endDateStr: string = endDate) => {
    // Block if account deleted
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }
    
    // Block if already adding
    if (isAddingSampleTransactions) {
      return;
    }
    
    // Set loading state
    setIsAddingSampleTransactions(true);
    setSampleTransactionProgress({ current: 0, total: count });
    
    // Clear all caches first to ensure we get the most current data
    UserDataManager.clearCache();

    // Get fresh account data
    const currentAccounts = UserDataManager.getUserData('bankAccounts', []);
    
    if (!Array.isArray(currentAccounts) || currentAccounts.length === 0) {
      alert('Error: No accounts found. Please refresh the page.');
      setIsAddingSampleTransactions(false);
      return;
    }

    const targetAccount = currentAccounts.find((acc: any) => acc.id === accountId);
    if (!targetAccount) {
      alert('Error: Account not found. Please refresh the page.');
      setIsAddingSampleTransactions(false);
      return;
    }

    try {
      const currentTransactions = UserDataManager.getUserData('bankTransactions', []);
      const newTransactions = [];
      let finalBalance = parseFloat(targetAccount.balance) || 0;

      // Create all transactions via API
      for (let i = 0; i < count; i++) {
        // Update progress
        setSampleTransactionProgress({ current: i + 1, total: count });
        // Randomly select a transaction template
        const randomTransaction = sampleTransactions[Math.floor(Math.random() * sampleTransactions.length)];
        
        // Create a random date within the specified date range
        const startDateObj = new Date(startDateStr);
        const endDateObj = new Date(endDateStr);
        const timeDiff = endDateObj.getTime() - startDateObj.getTime();
        const randomTime = Math.random() * timeDiff;
        const transactionDate = new Date(startDateObj.getTime() + randomTime);
        const randomHours = Math.floor(Math.random() * 24);
        const randomMinutes = Math.floor(Math.random() * 60);
        transactionDate.setHours(randomHours, randomMinutes, 0, 0);
        
        // Calculate transaction amount
        const rawAmount = Math.abs(randomTransaction.amount);
        const transactionAmount = randomTransaction.type === 'credit' ? rawAmount : -rawAmount;
        
        // Create transaction via API
        const transactionData = {
          accountId: accountId,
          amount: transactionAmount >= 0 ? `+${transactionAmount.toFixed(2)}` : transactionAmount.toFixed(2),
          description: randomTransaction.description,
          category: randomTransaction.type === 'credit' ? 'income' : 'expense',
          type: randomTransaction.type,
          timestamp: transactionDate.toISOString(),
          isSample: true
        };

        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(transactionData)
        });

        if (!response.ok) {
          console.error(`Failed to create transaction ${i + 1}/${count}`);
          continue;
        }

        const result = await response.json();
        newTransactions.push(result.transaction);
        finalBalance = parseFloat(result.newBalance);
      }

      // Update local state with the final balance from server
      const updatedAccounts = currentAccounts.map((acc: any) => {
        if (acc.id === accountId) {
          return { ...acc, balance: finalBalance.toFixed(2) };
        }
        return acc;
      });

      // Combine with existing transactions
      const allTransactions = [...currentTransactions, ...newTransactions];
      
      // Save everything to local storage
      UserDataManager.setUserData('bankTransactions', allTransactions);
      UserDataManager.setUserData('bankAccounts', updatedAccounts);
      
      // Update local state
      setAccounts(updatedAccounts);
      
      // Clear cache again after updates
      UserDataManager.clearCache();

      console.log(`💳 Added ${newTransactions.length} sample transactions to ${targetAccount.displayName} in database`);

      // Notify all components of the changes
      window.dispatchEvent(new CustomEvent('transactionUpdate'));
      window.dispatchEvent(new CustomEvent('transactionAdded', {
        detail: { transactions: newTransactions, count: newTransactions.length, accountId }
      }));
      window.dispatchEvent(new CustomEvent('balanceUpdate', {
        detail: { 
          accountId, 
          newBalance: finalBalance.toFixed(2), 
          accounts: updatedAccounts 
        }
      }));
      
      setShowSampleTransactions(false);
      const currentCurrency = getUserCurrency();
      const currencySymbol = currentCurrency === 'EUR' ? '€' : '£';
      showDeveloperMessage(`Successfully added ${newTransactions.length} sample transaction${newTransactions.length === 1 ? '' : 's'} to ${targetAccount.displayName}!\n\nNew Balance: ${currencySymbol}${finalBalance.toFixed(2)}`);
    } catch (error) {
      console.error('Failed to create sample transactions:', error);
      alert('Failed to add transactions. Please try again.');
    } finally {
      setIsAddingSampleTransactions(false);
      setSampleTransactionProgress({ current: 0, total: 0 });
    }
  };

  const resetToDefaults = async () => {
    // Block if account deleted
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }
    
    // Get current accounts and reset their balances to 0.00
    const currentAccounts = UserDataManager.getUserData('bankAccounts', []);
    const resetAccounts = currentAccounts.map((acc: any) => ({
      ...acc,
      balance: "0.00"
    }));
    
    // Reset financial data through UserDataManager (single write path keeps
    // localStorage and the in-memory cache in agreement). Auth/session data
    // is untouched, and bankAccounts keeps its structure with zeroed
    // balances. The old version wrote these empty arrays and then deleted
    // the same keys it had just written, with cache clears sprinkled in -
    // three mechanisms fighting over the same state.
    UserDataManager.setUserAccounts(resetAccounts);
    UserDataManager.setUserData('bankTransactions', []);
    UserDataManager.setUserData('savedPayees', []);
    UserDataManager.setUserData('recentPayees', []);

    // Clear legacy (pre-per-user-namespacing) financial data only
    localStorage.removeItem('bankTransactions');
    localStorage.removeItem('savedPayees');
    localStorage.removeItem('recentPayees');
    // Note: not clearing 'bankAccounts', 'bankingUser', 'currentUser', 'lastActiveUser'

    // Update local state immediately
    setAccounts(resetAccounts);
    
    // Clear all transactions from PostgreSQL database
    try {
      await fetch('/api/transactions/clear-all', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      console.log('🗑️ All transactions cleared from database');
    } catch (error) {
      console.error('Failed to clear transactions from database:', error);
    }
    
    // Persist reset balances to PostgreSQL for each account
    for (const account of resetAccounts) {
      if (account.id) {
        fetch(`/api/accounts/${account.id}/balance`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ balance: "0.00" })
        }).then(() => {
          console.log(`💰 Reset balance persisted for account ${account.id}`);
        }).catch(console.error);
      }
    }
    
    // Dispatch comprehensive events to notify all components
    window.dispatchEvent(new CustomEvent('transactionUpdate'));
    window.dispatchEvent(new CustomEvent('transactionDeleted'));
    window.dispatchEvent(new CustomEvent('balanceUpdate', {
      detail: { reset: true, accounts: resetAccounts }
    }));
    window.dispatchEvent(new CustomEvent('accountsReset', {
      detail: { accounts: resetAccounts }
    }));
    
    // Force refresh by updating accounts again after a short delay
    setTimeout(() => {
      setAccounts([...resetAccounts]);
      window.dispatchEvent(new CustomEvent('balanceUpdate', {
        detail: { reset: true, accounts: resetAccounts }
      }));
    }, 100);
    
    const currentCurrency = getUserCurrency();
    const currencySymbol = currentCurrency === 'EUR' ? '€' : '£';
    showDeveloperMessage(`Data reset to defaults successfully - all balances set to ${currencySymbol}0.00, transactions cleared`);
  };

  // Load transactions for selected account - sorted by latest first (from both DB and localStorage)
  const loadAccountTransactions = async (accountId: string) => {
    // First, load from localStorage for immediate display
    const localTransactions = UserDataManager.getUserData('bankTransactions', []) || [];
    const localFiltered = localTransactions
      .filter((tx: any) => tx.accountId === parseInt(accountId))
      .sort((a: any, b: any) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateB - dateA;
      });
    
    // Then try to load from database API
    try {
      const response = await fetch(`/api/transactions/${accountId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const dbTransactions = await response.json();
        // Merge database transactions with local transactions (DB takes priority by ID)
        const dbIds = new Set(dbTransactions.map((tx: any) => tx.id));
        const combinedTransactions = [
          ...dbTransactions,
          ...localFiltered.filter((tx: any) => !dbIds.has(tx.id))
        ].sort((a: any, b: any) => {
          const dateA = new Date(a.timestamp).getTime();
          const dateB = new Date(b.timestamp).getTime();
          return dateB - dateA;
        });
        setAccountTransactions(combinedTransactions);
        return;
      }
    } catch (error) {
      console.error('Error loading transactions from API:', error);
    }
    
    // Fallback to local only
    setAccountTransactions(localFiltered);
  };

  // Handle transaction deletion - Single action with instant updates
  const handleDeleteTransaction = async () => {
    // Block if account deleted
    if (accountDeleted) {
      alert('Account Deleted');
      return;
    }
    
    if (!selectedTransaction || !selectedAccountId) return;

    // Check if this is a database transaction (has numeric ID from PostgreSQL)
    const isDbTransaction = typeof selectedTransaction.id === 'number' && selectedTransaction.id > 0;
    
    if (isDbTransaction) {
      // Try to delete from database API first
      try {
        const response = await fetch(`/api/transactions/${selectedTransaction.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('💳 Database transaction deleted:', result);
          
          // Update local account balance from API response
          if (result.newBalance) {
            const userAccounts = UserDataManager.getUserData('bankAccounts', []) || [];
            const updatedAccounts = userAccounts.map((acc: any) => 
              acc.id === selectedTransaction.accountId 
                ? { ...acc, balance: result.newBalance }
                : acc
            );
            UserDataManager.setUserData('bankAccounts', updatedAccounts);
            setAccounts(updatedAccounts);
            
            window.dispatchEvent(new CustomEvent('balanceUpdate', {
              detail: { 
                accountId: selectedTransaction.accountId, 
                newBalance: result.newBalance,
                accounts: updatedAccounts
              }
            }));
          }
          
          // Reload transactions from API
          const txResponse = await fetch(`/api/transactions/${selectedAccountId}`, {
            credentials: 'include'
          });
          if (txResponse.ok) {
            const dbTransactions = await txResponse.json();
            setAccountTransactions(dbTransactions);
          }
          
          // Reset modal state
          setSelectedTransaction(null);
          setShowDeleteConfirm(false);
          setShowDeleteTransaction(false);
          
          window.dispatchEvent(new CustomEvent('forceRefresh'));
          showDeveloperMessage('Transaction deleted successfully.');
          return;
        } else if (response.status === 404) {
          // Not on the server at all - a local-only transaction (e.g. made
          // before transactions were synced server-side). Handle it locally.
          console.log('Transaction not found on server - deleting locally...');
        } else {
          // The server HAS this transaction but failed to delete it (5xx).
          // Do NOT delete locally - that would refund the balance while the
          // transaction still exists server-side, guaranteeing a mismatch.
          console.error(`Server delete failed with status ${response.status}`);
          showDeveloperMessage('Could not delete the transaction right now. Please try again.');
          return;
        }
      } catch (error) {
        // Network failure/offline - fall through to the local path so the
        // app keeps working offline; the balance sync below queues until
        // connectivity returns.
        console.error('Error deleting from database:', error);
      }
    }

    // Fall back to local storage deletion (for non-database transactions)
    const storedTransactions = UserDataManager.getUserData('bankTransactions', []) || [];
    
    // Filter out the selected transaction
    const updatedTransactions = storedTransactions.filter((tx: any) => tx.id !== selectedTransaction.id);
    
    // Update transactions in storage
    UserDataManager.setUserData('bankTransactions', updatedTransactions);
    
    // Get user accounts to update balance (with null safety)
    const userAccounts = UserDataManager.getUserData('bankAccounts', []) || [];
    const affectedAccount = userAccounts.find((acc: any) => acc.id === selectedTransaction.accountId);
    
    let updatedAccounts = userAccounts;
    if (affectedAccount) {
      // Calculate balance adjustment
      const transactionAmount = parseFloat(selectedTransaction.amount.replace('-', ''));
      const isDebit = selectedTransaction.amount.startsWith('-');
      
      // Reverse the transaction effect on balance
      let currentBalance = parseFloat(affectedAccount.balance);
      if (isDebit) {
        // If it was a debit, add the amount back
        currentBalance += transactionAmount;
      } else {
        // If it was a credit, subtract the amount
        currentBalance -= transactionAmount;
      }
      
      // Update account balance
      updatedAccounts = userAccounts.map((acc: any) => 
        acc.id === selectedTransaction.accountId 
          ? { ...acc, balance: currentBalance.toFixed(2) }
          : acc
      );
      
      // Save updated accounts to storage
      UserDataManager.setUserData('bankAccounts', updatedAccounts);

      // Instantly update local accounts state in admin panel
      setAccounts(updatedAccounts);

      // CRITICAL: push the refunded balance to the server (queued if
      // offline). This local-only delete path previously adjusted the
      // balance in localStorage but never told the server, so the next
      // dashboard load pulled the old server balance back - the classic
      // "balance changes back after I delete a transaction" mismatch.
      syncBalanceToServer(String(selectedTransaction.accountId), currentBalance.toFixed(2));

      // If this transaction was still queued for server sync, cancel it so
      // it doesn't get pushed (and reappear) on reconnect
      cancelPendingTransactionSync(selectedTransaction.id);

      // Dispatch comprehensive balance update events for all components
      window.dispatchEvent(new CustomEvent('balanceUpdate', {
        detail: {
          accountId: selectedTransaction.accountId,
          newBalance: currentBalance.toFixed(2),
          accounts: updatedAccounts
        }
      }));
      
      // Dispatch account update for dashboard and other components
      window.dispatchEvent(new CustomEvent('accountsUpdated', {
        detail: { accounts: updatedAccounts }
      }));
    }
    
    // Instantly update local transaction list in admin panel
    const accountSpecificTransactions = updatedTransactions.filter((tx: any) => tx.accountId === parseInt(selectedAccountId));
    setAccountTransactions(accountSpecificTransactions);
    
    // Reset modal state
    setSelectedTransaction(null);
    setShowDeleteConfirm(false);
    setShowDeleteTransaction(false);
    
    // Dispatch comprehensive transaction update events
    window.dispatchEvent(new CustomEvent('transactionDeleted', {
      detail: { 
        transactionId: selectedTransaction.id,
        accountId: selectedTransaction.accountId,
        transactions: updatedTransactions
      }
    }));
    
    window.dispatchEvent(new CustomEvent('transactionUpdate', {
      detail: { 
        transactions: updatedTransactions,
        accounts: updatedAccounts
      }
    }));
    
    // Force dashboard refresh
    window.dispatchEvent(new CustomEvent('forceRefresh'));
    
    showDeveloperMessage('Transaction deleted successfully.');
  };

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header - Teal blue bar */}
      <div className="bg-[#126987] px-4 py-4 flex items-center" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <button 
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 flex items-center justify-center active:scale-95 transition-transform"
          data-testid="button-back"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="flex-1 text-center text-white font-semibold text-lg -ml-10" style={{ fontFamily: 'OpenSans, sans-serif' }}>
          Profile
        </h1>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto flex flex-col" style={{ WebkitOverflowScrolling: 'touch' }}>
        {isLoadingProfile ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-[#126987] rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>Loading profile...</p>
          </div>
        ) : (
          <div className="px-4 pb-32">
            {/* Profile Header Section */}
              <div className="flex flex-col items-center text-center py-8">
                {/* Profile Icon - Circular teal outline with silhouette */}
                <button 
                  onClick={handleProfilePictureTap}
                  onTouchStart={(e) => e.preventDefault()}
                  className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 active:scale-95 transition-all duration-200 touch-manipulation border-2 border-[#126987]"
                  style={{
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation'
                  }}
                  data-testid="button-profile-picture"
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#126987" strokeWidth="1.5">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                  </svg>
                </button>

                {/* User ID */}
                <p className="text-gray-700 text-base font-medium mb-4" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  User ID: {userDetails.customerNumber}
                </p>

                {/* Log Out Button */}
                <button 
                  onClick={() => {
                    if (accountDeleted) {
                      alert('Account Deleted');
                      return;
                    }
                    logout();
                    navigate('/login');
                  }}
                  className="px-14 py-2 bg-white border border-[#126987] active:bg-gray-50 transition-colors"
                  style={{ borderRadius: '4px' }}
                  data-testid="button-logout"
                >
                  <span className="text-[#126987] font-bold text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Log out
                  </span>
                </button>
              </div>

              {/* Settings List */}
              <div className="space-y-3 mt-6 mx-auto px-4" style={{ maxWidth: '393px', width: '100%' }}>
                {/* Personal details */}
                <button 
                  onClick={() => {
                    setShowPersonalDetails(true);
                    setIsLoadingPersonalDetails(true);
                    setTimeout(() => {
                      setIsLoadingPersonalDetails(false);
                    }, 1500);
                  }}
                  className="w-full flex items-center justify-between px-4 py-5 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                  style={{ minHeight: '68px', borderRadius: '4px' }}
                  data-testid="button-personal-details"
                >
                  <div className="flex items-center gap-4">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1a5a6e" strokeWidth="1.5">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                    </svg>
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Personal details
                    </span>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                </button>

                {/* My security devices */}
                <button 
                  onClick={() => {
                    setShowSecurityDevices(true);
                    setIsLoadingSecurityDevices(true);
                    setTimeout(() => {
                      setIsLoadingSecurityDevices(false);
                    }, 1500);
                  }}
                  className="w-full flex items-center justify-between px-4 py-5 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                  style={{ minHeight: '68px', borderRadius: '4px' }}
                  data-testid="button-security-devices"
                >
                  <div className="flex items-center gap-4">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1a5a6e" strokeWidth="1.5">
                      <rect x="5" y="2" width="14" height="20" rx="2" />
                      <circle cx="12" cy="18" r="1" fill="#1a5a6e" />
                    </svg>
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      My security devices
                    </span>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                </button>

                {/* Face ID */}
                <button 
                  onClick={() => {
                    setShowFaceId(true);
                    setIsLoadingFaceId(true);
                    setTimeout(() => {
                      setIsLoadingFaceId(false);
                    }, 1500);
                  }}
                  className="w-full flex items-center justify-between px-4 py-5 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                  style={{ minHeight: '68px', borderRadius: '4px' }}
                  data-testid="button-face-id"
                >
                  <div className="flex items-center gap-4">
                    <img 
                      src={faceIdIconPath} 
                      alt="Face ID" 
                      className="w-6 h-6"
                      style={{ filter: 'invert(27%) sepia(85%) saturate(456%) hue-rotate(158deg) brightness(93%) contrast(91%)' }}
                    />
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Face ID
                    </span>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                </button>

                {/* Open banking connections */}
                <button 
                  onClick={() => {
                    setShowOpenBanking(true);
                    setIsLoadingOpenBanking(true);
                    setTimeout(() => {
                      setIsLoadingOpenBanking(false);
                    }, 1500);
                  }}
                  className="w-full flex items-center justify-between px-4 py-5 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                  style={{ minHeight: '68px', borderRadius: '4px' }}
                  data-testid="button-open-banking"
                >
                  <div className="flex items-center gap-4">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1a5a6e" strokeWidth="1.5">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Open banking connections
                    </span>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                </button>

                {/* Privacy and preferences */}
                <button 
                  onClick={() => {
                    setShowPrivacy(true);
                    setIsLoadingPrivacy(true);
                    setTimeout(() => {
                      setIsLoadingPrivacy(false);
                    }, 1500);
                  }}
                  className="w-full flex items-center justify-between px-4 py-5 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                  style={{ minHeight: '68px', borderRadius: '4px' }}
                  data-testid="button-privacy"
                >
                  <div className="flex items-center gap-4">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1a5a6e" strokeWidth="1.5">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <line x1="7" y1="8" x2="17" y2="8" />
                      <line x1="7" y1="12" x2="17" y2="12" />
                      <line x1="7" y1="16" x2="13" y2="16" />
                    </svg>
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Privacy and preferences
                    </span>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                </button>

                {/* Security and Legal */}
                <button 
                  onClick={() => {
                    setShowSecurityLegal(true);
                    setIsLoadingSecurityLegal(true);
                    setTimeout(() => {
                      setIsLoadingSecurityLegal(false);
                    }, 1500);
                  }}
                  className="w-full flex items-center justify-between px-4 py-5 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                  style={{ minHeight: '68px', borderRadius: '4px' }}
                  data-testid="button-security-legal"
                >
                  <div className="flex items-center gap-4">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1a5a6e" strokeWidth="1.5">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Security and Legal
                    </span>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                </button>
              </div>

            {/* Version Footer */}
            <div className="text-center mt-8 mb-4">
              <p className="text-gray-400 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                V 11.06
              </p>
              <p className="text-gray-400 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                BOI.UAPR27-2
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Customer Panel Modal */}
      {showAdminPanel && (
        <div 
          className="admin-panel bg-black bg-opacity-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAdminPanel(false);
            }
          }}
        >
          <div 
            className="bg-white w-full h-full overflow-y-auto modal-content"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Customer Panel
                </h2>
                <button
                  onClick={() => setShowAdminPanel(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Developer ID Notice */}
              <div className="mb-6 p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-2xl shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <PhoneCall className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-bold text-base mb-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Looking for an ID to match with your app?
                    </p>
                    <p className="text-gray-700 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      The developer sells photos of them for only £50
                    </p>
                  </div>
                </div>
                <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl mb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>Contact Developer</p>
                      <p className="text-gray-900 font-bold text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        +44 7310 658405
                      </p>
                    </div>
                    <a
                      href="https://wa.me/447310658405"
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="button-whatsapp-contact"
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 active:bg-green-700 rounded-xl transition-colors shadow-md active:scale-95"
                    >
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      <span className="text-white font-semibold text-sm">Chat</span>
                    </a>
                  </div>
                </div>
                <p className="text-gray-700 text-xs italic text-center" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  What Goods an app without an id? • Stay in contact for app updates
                </p>
              </div>

              {/* Date & Time Override Section */}
              <div className="mb-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-5 border-2 border-teal-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <p className="font-bold text-teal-900 text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>Date & Time Override</p>
                </div>
                <p className="text-teal-700 text-xs mb-4" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Set a custom date and time to use on all transfer documents, confirmation PDFs, and live chat messages instead of the real current time.
                </p>

                {/* Toggle */}
                <button
                  onClick={() => {
                    const next = !customDateEnabled;
                    setCustomDateEnabled(next);
                    if (next) {
                      const d = new Date(`${customDateInput}T${customTimeInput}`);
                      setCustomAppDate(d);
                    } else {
                      setCustomAppDate(null);
                      // Snap inputs back to real device time so user can see what real time is
                      const now = new Date();
                      setCustomDateInput(now.toLocaleDateString('en-CA'));
                      setCustomTimeInput(now.toTimeString().slice(0, 5));
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 bg-white/70 backdrop-blur-sm border-2 border-teal-200 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md mb-3"
                >
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-teal-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Use Custom Date & Time
                    </p>
                    <p className="text-xs text-teal-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      {customDateEnabled ? `Active — ${customDateInput} at ${customTimeInput}` : 'Off — using real current time'}
                    </p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors ${customDateEnabled ? 'bg-teal-500' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform mt-1 ${customDateEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </button>

                {/* Date & Time Inputs */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-teal-800 mb-1 px-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>Date</p>
                      <input
                        type="date"
                        value={customDateInput}
                        onChange={(e) => {
                          setCustomDateInput(e.target.value);
                          if (customDateEnabled && e.target.value) {
                            const d = new Date(`${e.target.value}T${customTimeInput}`);
                            setCustomAppDate(d);
                          }
                        }}
                        className="w-full p-2.5 rounded-xl border-2 border-teal-200 bg-white text-sm text-gray-800 focus:outline-none focus:border-teal-400"
                        style={{ fontFamily: 'OpenSans, sans-serif' }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-teal-800 mb-1 px-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>Time</p>
                      <input
                        type="time"
                        value={customTimeInput}
                        onChange={(e) => {
                          setCustomTimeInput(e.target.value);
                          if (customDateEnabled && e.target.value) {
                            const d = new Date(`${customDateInput}T${e.target.value}`);
                            setCustomAppDate(d);
                          }
                        }}
                        className="w-full p-2.5 rounded-xl border-2 border-teal-200 bg-white text-sm text-gray-800 focus:outline-none focus:border-teal-400"
                        style={{ fontFamily: 'OpenSans, sans-serif' }}
                      />
                    </div>
                  </div>
                  {customDateEnabled && (
                    <button
                      onClick={() => {
                        setCustomDateEnabled(false);
                        setCustomAppDate(null);
                        const now = new Date();
                        setCustomDateInput(now.toLocaleDateString('en-CA'));
                        setCustomTimeInput(now.toTimeString().slice(0, 5));
                      }}
                      className="w-full p-2.5 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 text-sm font-semibold active:scale-95 transition-all"
                      style={{ fontFamily: 'OpenSans, sans-serif' }}
                    >
                      Clear — Switch Back to Real Time
                    </button>
                  )}
                </div>
              </div>

              {/* Currency & Settings Section */}
              <div className="mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-5 border-2 border-purple-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                    <Settings className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Transfer & Currency Settings
                  </h3>
                </div>
                
                {/* Currency Selection */}
                <div className="mb-4">
                  <p className="text-xs font-bold text-purple-700 mb-3 uppercase tracking-wide px-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Currency Selection
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={async () => {
                      if (accountDeleted) {
                        alert('Account Deleted');
                        return;
                      }
                      
                      const newCurrency = 'EUR';
                      setUserCurrency(newCurrency);
                      setProfileData({ ...profileData, currency: newCurrency });
                      setEditProfileData({ ...editProfileData, currency: newCurrency });
                      
                      try {
                        const currentCustomerNumber = UserDataManager.getCurrentUser();
                        const response = await fetch(`/api/profile/${currentCustomerNumber}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: profileData.name,
                            email: profileData.email,
                            phone: profileData.phone || '',
                            address: profileData.address || '',
                            dateOfBirth: profileData.dateOfBirth || '',
                            joinDate: profileData.joinDate || '',
                            currency: newCurrency
                          })
                        });
                        
                        if (response.ok) {
                          const updatedData = await response.json();
                          UserDataManager.updateUserProfile({
                            ...profileData,
                            currency: updatedData.currency || 'EUR'
                          });
                          showDeveloperMessage('Currency changed to EUR (€) successfully');
                        }
                      } catch (error) {
                        console.error('Error saving currency:', error);
                      }
                    }}
                    data-testid="button-currency-eur"
                    className={`p-4 rounded-xl border-2 transition-all active:scale-95 ${
                      userCurrency === 'EUR' 
                        ? 'border-purple-500 bg-purple-100 shadow-md' 
                        : 'border-purple-200 bg-white hover:bg-purple-50'
                    }`}
                  >
                    <p className={`font-bold text-base ${userCurrency === 'EUR' ? 'text-purple-900' : 'text-gray-900'}`} style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      BOI
                    </p>
                    <p className={`text-sm font-medium ${userCurrency === 'EUR' ? 'text-purple-700' : 'text-gray-600'}`} style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      EUR (€)
                    </p>
                    {userCurrency === 'EUR' && (
                      <div className="mt-2 w-2 h-2 bg-purple-500 rounded-full mx-auto"></div>
                    )}
                  </button>
                  <button
                    onClick={async () => {
                      if (accountDeleted) {
                        alert('Account Deleted');
                        return;
                      }
                      
                      const newCurrency = 'GBP';
                      setUserCurrency(newCurrency);
                      setProfileData({ ...profileData, currency: newCurrency });
                      setEditProfileData({ ...editProfileData, currency: newCurrency });
                      
                      try {
                        const currentCustomerNumber = UserDataManager.getCurrentUser();
                        const response = await fetch(`/api/profile/${currentCustomerNumber}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: profileData.name,
                            email: profileData.email,
                            phone: profileData.phone || '',
                            address: profileData.address || '',
                            dateOfBirth: profileData.dateOfBirth || '',
                            joinDate: profileData.joinDate || '',
                            currency: newCurrency
                          })
                        });
                        
                        if (response.ok) {
                          const updatedData = await response.json();
                          UserDataManager.updateUserProfile({
                            ...profileData,
                            currency: updatedData.currency || 'GBP'
                          });
                          showDeveloperMessage('Currency changed to GBP (£) successfully');
                        }
                      } catch (error) {
                        console.error('Error saving currency:', error);
                      }
                    }}
                    data-testid="button-currency-gbp"
                    className={`p-4 rounded-xl border-2 transition-all active:scale-95 ${
                      userCurrency === 'GBP' 
                        ? 'border-purple-500 bg-purple-100 shadow-md' 
                        : 'border-purple-200 bg-white hover:bg-purple-50'
                    }`}
                  >
                    <p className={`font-bold text-base ${userCurrency === 'GBP' ? 'text-purple-900' : 'text-gray-900'}`} style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      BOI UK
                    </p>
                    <p className={`text-sm font-medium ${userCurrency === 'GBP' ? 'text-purple-700' : 'text-gray-600'}`} style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      GBP (£)
                    </p>
                    {userCurrency === 'GBP' && (
                      <div className="mt-2 w-2 h-2 bg-purple-500 rounded-full mx-auto"></div>
                    )}
                  </button>
                </div>
                </div>

                {/* Transfer Options Section */}
                <div className="mb-4">
                  <p className="text-xs font-bold text-purple-700 mb-3 uppercase tracking-wide px-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Transfer Options
                  </p>
                  <div className="space-y-2">
                    {/* SEPA Transfer */}
                    <button 
                      onClick={() => {
                        const newSettings = { ...transferSettings, showSepaTransfer: !transferSettings.showSepaTransfer };
                        setTransferSettings(newSettings);
                        UserDataManager.setUserData('transferSettings', newSettings);
                        UserDataManager.clearCache('transferSettings');
                        window.dispatchEvent(new CustomEvent('transferSettingsUpdate'));
                        showDeveloperMessage(`SEPA Transfer ${newSettings.showSepaTransfer ? 'enabled' : 'disabled'} successfully`);
                      }}
                      data-testid="toggle-sepa-transfer"
                      className="w-full flex items-center justify-between p-3 bg-white/70 backdrop-blur-sm border-2 border-purple-200 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-purple-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          SEPA Transfer
                        </p>
                        <p className="text-xs text-purple-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          European payments
                        </p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-colors ${transferSettings.showSepaTransfer ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform mt-1 ${transferSettings.showSepaTransfer ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </button>

                    {/* UK Transfer */}
                    <button 
                      onClick={() => {
                        const newSettings = { ...transferSettings, showUkTransfer: !transferSettings.showUkTransfer };
                        setTransferSettings(newSettings);
                        UserDataManager.setUserData('transferSettings', newSettings);
                        UserDataManager.clearCache('transferSettings');
                        window.dispatchEvent(new CustomEvent('transferSettingsUpdate'));
                        showDeveloperMessage(`UK Transfer ${newSettings.showUkTransfer ? 'enabled' : 'disabled'} successfully`);
                      }}
                      data-testid="toggle-uk-transfer"
                      className="w-full flex items-center justify-between p-3 bg-white/70 backdrop-blur-sm border-2 border-purple-200 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-purple-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          UK Bank Transfer
                        </p>
                        <p className="text-xs text-purple-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Sort code & account number
                        </p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-colors ${transferSettings.showUkTransfer ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform mt-1 ${transferSettings.showUkTransfer ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </button>

                    {/* Internal Transfer */}
                    <button 
                      onClick={() => {
                        const newSettings = { ...transferSettings, showInternalTransfer: !transferSettings.showInternalTransfer };
                        setTransferSettings(newSettings);
                        UserDataManager.setUserData('transferSettings', newSettings);
                        UserDataManager.clearCache('transferSettings');
                        window.dispatchEvent(new CustomEvent('transferSettingsUpdate'));
                        showDeveloperMessage(`Internal Transfer ${newSettings.showInternalTransfer ? 'enabled' : 'disabled'} successfully`);
                      }}
                      data-testid="toggle-internal-transfer"
                      className="w-full flex items-center justify-between p-3 bg-white/70 backdrop-blur-sm border-2 border-purple-200 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-purple-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Between BOI Accounts
                        </p>
                        <p className="text-xs text-purple-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Internal transfers
                        </p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-colors ${transferSettings.showInternalTransfer ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform mt-1 ${transferSettings.showInternalTransfer ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </button>

                    {/* Email Transfer */}
                    <button 
                      onClick={() => {
                        const newSettings = { ...transferSettings, showEmailTransfer: !transferSettings.showEmailTransfer };
                        setTransferSettings(newSettings);
                        UserDataManager.setUserData('transferSettings', newSettings);
                        UserDataManager.clearCache('transferSettings');
                        window.dispatchEvent(new CustomEvent('transferSettingsUpdate'));
                        showDeveloperMessage(`Email Transfer ${newSettings.showEmailTransfer ? 'enabled' : 'disabled'} successfully`);
                      }}
                      data-testid="toggle-email-transfer"
                      className="w-full flex items-center justify-between p-3 bg-white/70 backdrop-blur-sm border-2 border-purple-200 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-purple-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Email Transfer
                        </p>
                        <p className="text-xs text-purple-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Send by name and email
                        </p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-colors ${transferSettings.showEmailTransfer ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform mt-1 ${transferSettings.showEmailTransfer ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </button>
                  </div>
                </div>

                {/* Email Notification Settings */}
                <div className="mb-4">
                  <p className="text-xs font-bold text-purple-700 mb-3 uppercase tracking-wide px-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Email Notifications
                  </p>
                  <div className="space-y-2">
                    {/* Transfer Confirmation */}
                    <button 
                      onClick={() => {
                        const newValue = !showTransferConfirmation;
                        setShowTransferConfirmation(newValue);
                        localStorage.setItem('showTransferConfirmation', JSON.stringify(newValue));
                        window.dispatchEvent(new Event('storage'));
                        showDeveloperMessage(`Transfer Confirmation ${newValue ? 'enabled' : 'disabled'} successfully`);
                      }}
                      data-testid="toggle-transfer-confirmation"
                      className="w-full flex items-center justify-between p-3 bg-white/70 backdrop-blur-sm border-2 border-purple-200 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-purple-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Show Confirmation Button
                        </p>
                        <p className="text-xs text-purple-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Display on transaction details
                        </p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-colors ${showTransferConfirmation ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform mt-1 ${showTransferConfirmation ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </button>

                    {/* Recipient Email UK */}
                    <button 
                      onClick={() => {
                        setRecipientEmailEnabled(!recipientEmailEnabled);
                        showDeveloperMessage(`Recipient Email (UK) ${!recipientEmailEnabled ? 'enabled' : 'disabled'} successfully`);
                      }}
                      data-testid="toggle-recipient-email-uk"
                      className="w-full flex items-center justify-between p-3 bg-white/70 backdrop-blur-sm border-2 border-purple-200 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-purple-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Recipient Email (UK)
                        </p>
                        <p className="text-xs text-purple-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Send copy to UK transfer recipients
                        </p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-colors ${recipientEmailEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform mt-1 ${recipientEmailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </button>

                    {/* Recipient Email SEPA */}
                    <button 
                      onClick={() => {
                        setIbanEmailEnabled(!ibanEmailEnabled);
                        showDeveloperMessage(`Recipient Email (SEPA) ${!ibanEmailEnabled ? 'enabled' : 'disabled'} successfully`);
                      }}
                      data-testid="toggle-recipient-email-sepa"
                      className="w-full flex items-center justify-between p-3 bg-white/70 backdrop-blur-sm border-2 border-purple-200 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-purple-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Recipient Email (SEPA)
                        </p>
                        <p className="text-xs text-purple-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Send copy to SEPA transfer recipients
                        </p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-colors ${ibanEmailEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform mt-1 ${ibanEmailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </button>
                  </div>
                </div>

                {/* Bank Details Display Settings */}
                <div className="mb-4">
                  <p className="text-xs font-bold text-purple-700 mb-3 uppercase tracking-wide px-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Bank Details Display
                  </p>
                  <div className="space-y-2">
                    {/* Show BIC/IBAN Button Toggle */}
                    <button 
                      onClick={() => {
                        const newValue = !showBankDetailsButton;
                        setShowBankDetailsButton(newValue);
                        localStorage.setItem('showBankDetailsButton', JSON.stringify(newValue));
                        window.dispatchEvent(new Event('storage'));
                        showDeveloperMessage(`Bank Details Button ${newValue ? 'shown' : 'hidden'} successfully`);
                      }}
                      data-testid="toggle-bank-details-button"
                      className="w-full flex items-center justify-between p-3 bg-white/70 backdrop-blur-sm border-2 border-purple-200 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-purple-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Show BIC/IBAN Button
                        </p>
                        <p className="text-xs text-purple-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Display on transaction history
                        </p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-colors ${showBankDetailsButton ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform mt-1 ${showBankDetailsButton ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </button>

                    {/* Edit Bank Display Details - Per Account */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-purple-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        Edit Bank Display Details (per account)
                      </p>
                      {accounts && accounts.length > 0 ? accounts.map((account) => (
                        <button 
                          key={account.id}
                          onClick={() => {
                            setEditingBankDisplayAccount(account);
                            const existingDisplay = customBankDisplayByAccount[account.id] || {
                              bic: '',
                              iban: '',
                              sortCode: '',
                              accountNumber: ''
                            };
                            setEditingBankDisplayData(existingDisplay);
                            setShowEditBankDisplay(true);
                          }}
                          data-testid={`button-edit-bank-display-${account.id}`}
                          className="w-full flex items-center space-x-3 p-2.5 bg-white/70 backdrop-blur-sm border border-purple-200 rounded-lg active:scale-95 transition-all shadow-sm hover:shadow-md"
                        >
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-500 rounded-full flex items-center justify-center shadow-sm">
                            <Edit3 className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-purple-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                              {account.displayName}
                            </p>
                            <p className="text-xs text-purple-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                              {customBankDisplayByAccount[account.id] ? 'Custom display set' : 'Using defaults'}
                            </p>
                          </div>
                        </button>
                      )) : (
                        <p className="text-xs text-purple-500 italic" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          No accounts available
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Management Section */}
              <div className="mb-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border-2 border-blue-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Profile Management
                  </h3>
                </div>
                  
                {/* Edit Profile */}
                <button 
                  onClick={startEditingProfile}
                  data-testid="button-edit-profile"
                  className="w-full flex items-center space-x-3 p-4 bg-white/80 backdrop-blur-sm border-2 border-blue-300 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                    <Edit3 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-blue-900 text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Edit Profile
                    </p>
                    <p className="text-sm text-blue-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Update personal information
                    </p>
                  </div>
                </button>
              </div>

              {/* Account & Transaction Management Section */}
              <div className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border-2 border-green-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Account & Transaction Tools
                  </h3>
                </div>
                  
                  <div className="space-y-3">
                    {/* Add Account */}
                    <button 
                      onClick={() => {
                        if (accountDeleted) {
                          alert('Account Deleted');
                          return;
                        }
                        if ((accounts?.length || 0) >= 5) {
                          showDeveloperMessage('Maximum of 5 accounts allowed. Please delete an existing account first.');
                          return;
                        }
                        setShowAddAccount(true);
                      }}
                      disabled={(accounts?.length || 0) >= 5}
                      data-testid="button-add-account"
                      className={`w-full flex items-center space-x-3 p-4 bg-white/70 backdrop-blur-sm border-2 rounded-xl transition-all shadow-sm ${
                        (accounts?.length || 0) >= 5 
                          ? 'border-gray-300 opacity-60 cursor-not-allowed' 
                          : 'border-green-300 active:scale-95 hover:shadow-md'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                        (accounts?.length || 0) >= 5 
                          ? 'bg-gradient-to-br from-gray-400 to-gray-500' 
                          : 'bg-gradient-to-br from-green-500 to-green-600'
                      }`}>
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`font-bold text-sm ${(accounts?.length || 0) >= 5 ? 'text-gray-600' : 'text-green-900'}`} style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Add Account
                        </p>
                        <p className={`text-xs ${(accounts?.length || 0) >= 5 ? 'text-gray-500' : 'text-green-700'}`} style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          {(accounts?.length || 0) >= 5 ? 'Maximum 5 accounts reached' : `${accounts?.length || 0}/5 accounts used`}
                        </p>
                      </div>
                    </button>

                    {/* Delete Account */}
                    <button 
                      onClick={() => {
                        if (accountDeleted) {
                          alert('Account Deleted');
                          return;
                        }
                        if ((accounts?.length || 0) <= 1) {
                          showDeveloperMessage('Cannot delete your only account. You must have at least one account.');
                          return;
                        }
                        setShowDeleteAccount(true);
                      }}
                      data-testid="button-delete-account"
                      className="w-full flex items-center space-x-3 p-4 bg-white/70 backdrop-blur-sm border-2 border-red-300 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-md">
                        <Trash2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-red-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Delete Account
                        </p>
                        <p className="text-xs text-red-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Remove a bank account
                        </p>
                      </div>
                    </button>

                    {/* Add Custom Transaction */}
                    <button 
                      onClick={() => {
                        if (accountDeleted) {
                          alert('Account Deleted');
                          return;
                        }
                        setShowAddTransaction(true);
                      }}
                      data-testid="button-add-transaction"
                      className="w-full flex items-center space-x-3 p-4 bg-white/70 backdrop-blur-sm border-2 border-green-300 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-md">
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-green-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Add Custom Transaction
                        </p>
                        <p className="text-xs text-green-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Create custom transaction entry
                        </p>
                      </div>
                    </button>

                    {/* Add Sample Transactions */}
                    <button 
                      onClick={() => {
                        if (accountDeleted) {
                          alert('Account Deleted');
                          return;
                        }
                        setShowSampleTransactions(true);
                      }}
                      data-testid="button-add-sample-transactions"
                      className="w-full flex items-center space-x-3 p-4 bg-white/70 backdrop-blur-sm border-2 border-green-300 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center shadow-md">
                        <HardDrive className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-green-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Add Sample Transactions
                        </p>
                        <p className="text-xs text-green-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Bulk add test transactions
                        </p>
                      </div>
                    </button>

                    {/* Delete Transaction */}
                    <button 
                      onClick={() => {
                        if (accountDeleted) {
                          alert('Account Deleted');
                          return;
                        }
                        setShowDeleteTransaction(true);
                      }}
                      data-testid="button-delete-transaction"
                      className="w-full flex items-center space-x-3 p-4 bg-white/70 backdrop-blur-sm border-2 border-green-300 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-md">
                        <Trash2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-green-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Delete Transaction
                        </p>
                        <p className="text-xs text-green-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                          Remove specific transactions
                        </p>
                      </div>
                    </button>

                    {/* Unblock Card */}
                    {UserDataManager.getUserData('cardBlocked') && (
                      <button 
                        onClick={() => {
                          if (accountDeleted) {
                            alert('Account Deleted');
                            return;
                          }
                          UserDataManager.setUserData('cardBlocked', false);
                          UserDataManager.clearCache('cardBlocked');
                          window.dispatchEvent(new CustomEvent('cardUnblocked'));
                          alert('Card has been unblocked successfully');
                        }}
                        data-testid="button-unblock-card"
                        className="w-full flex items-center space-x-3 p-4 bg-white/70 backdrop-blur-sm border-2 border-green-300 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-lime-500 to-lime-600 rounded-full flex items-center justify-center shadow-md">
                          <CreditCard className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-bold text-green-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                            Unblock Card
                          </p>
                          <p className="text-xs text-green-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                            Card is currently blocked
                          </p>
                        </div>
                      </button>
                    )}
                  </div>
              </div>

              {/* Balance Management Section */}
              <div className="mb-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-5 border-2 border-orange-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Balance Management
                  </h3>
                </div>
                  
                <div className="space-y-3">
                    {accounts && Array.isArray(accounts) ? (
                      accounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <div>
                            <p className="font-semibold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                              {account.displayName}
                            </p>
                            <p className="text-sm text-gray-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                              {account.accountNumber}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (accountDeleted) {
                                alert('Account Deleted');
                                return;
                              }
                              setEditingAccount(account);
                              setNewBalance(account.balance);
                              setNewAccountName(account.displayName);
                            }}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-200 transition-colors"
                            style={{ fontFamily: 'OpenSans, sans-serif' }}
                          >
                            {formatCurrency(account.balance, userCurrency)}
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        No account data found
                      </div>
                    )}
                  </div>
              </div>

              {/* System Management Section */}
              <div className="mb-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-5 border-2 border-red-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    System Management
                  </h3>
                </div>
                  
                {/* Reset to Defaults */}
                <button 
                  onClick={resetToDefaults}
                  data-testid="button-reset-defaults"
                  className="w-full flex items-center space-x-3 p-4 bg-white/80 backdrop-blur-sm border-2 border-red-300 rounded-xl active:scale-95 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="w-11 h-11 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-md">
                    <RefreshCw className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-red-900 text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Reset to Defaults
                    </p>
                    <p className="text-sm text-red-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Clear all data and reset balances
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="modal-overlay bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Edit Profile
                </h2>
                <button
                  onClick={() => setShowEditProfile(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={editProfileData.name}
                    onChange={(e) => setEditProfileData({ ...editProfileData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={editProfileData.email}
                    onChange={(e) => setEditProfileData({ ...editProfileData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editProfileData.phone}
                    onChange={(e) => setEditProfileData({ ...editProfileData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Address
                  </label>
                  <input
                    type="text"
                    value={editProfileData.address}
                    onChange={(e) => setEditProfileData({ ...editProfileData, address: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    placeholder="Enter your address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={editProfileData.dateOfBirth}
                    onChange={(e) => setEditProfileData({ ...editProfileData, dateOfBirth: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Member Since
                  </label>
                  <input
                    type="text"
                    value={editProfileData.joinDate}
                    onChange={(e) => setEditProfileData({ ...editProfileData, joinDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    placeholder="e.g., Member since 2018"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowEditProfile(false)}
                  className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  onClick={updateProfile}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bank Display Modal - Per Account */}
      {showEditBankDisplay && editingBankDisplayAccount && (
        <div className="modal-overlay bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-xl">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Bank Display Details
                  </h2>
                  <p className="text-xs text-purple-600 font-medium" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    {editingBankDisplayAccount.displayName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowEditBankDisplay(false);
                    setEditingBankDisplayAccount(null);
                  }}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <p className="text-xs text-gray-400 mb-5" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                Custom values for this account only. Leave empty for defaults.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    BIC
                  </label>
                  <input
                    type="text"
                    value={editingBankDisplayData.bic}
                    onChange={(e) => setEditingBankDisplayData({ ...editingBankDisplayData, bic: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#126987] focus:border-transparent text-sm text-gray-800"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    placeholder={editingBankDisplayAccount.bic || "BOFIIE2DXXX"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    IBAN
                  </label>
                  <input
                    type="text"
                    value={editingBankDisplayData.iban}
                    onChange={(e) => setEditingBankDisplayData({ ...editingBankDisplayData, iban: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#126987] focus:border-transparent text-sm text-gray-800"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    placeholder={editingBankDisplayAccount.iban || "IE40BOFI 903816 20163704"}
                  />
                </div>
                
                <div className="border-t border-gray-100 pt-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Sort Code
                  </label>
                  <input
                    type="text"
                    value={editingBankDisplayData.sortCode}
                    onChange={(e) => setEditingBankDisplayData({ ...editingBankDisplayData, sortCode: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#126987] focus:border-transparent text-sm text-gray-800"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    placeholder={editingBankDisplayAccount.sortCode || "90-38-16"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={editingBankDisplayData.accountNumber}
                    onChange={(e) => setEditingBankDisplayData({ ...editingBankDisplayData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#126987] focus:border-transparent text-sm text-gray-800"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    placeholder={editingBankDisplayAccount.fullAccountNumber || editingBankDisplayAccount.accountNumber || "20163704"}
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    const accountId = editingBankDisplayAccount.id;
                    const newDisplayByAccount = { ...customBankDisplayByAccount };
                    delete newDisplayByAccount[accountId];
                    setCustomBankDisplayByAccount(newDisplayByAccount);
                    localStorage.setItem('customBankDisplayByAccount', JSON.stringify(newDisplayByAccount));
                    setEditingBankDisplayData({ bic: '', iban: '', sortCode: '', accountNumber: '' });
                    showDeveloperMessage(`Reset ${editingBankDisplayAccount.displayName} to defaults`);
                  }}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    const accountId = editingBankDisplayAccount.id;
                    const newDisplayByAccount = {
                      ...customBankDisplayByAccount,
                      [accountId]: editingBankDisplayData
                    };
                    setCustomBankDisplayByAccount(newDisplayByAccount);
                    localStorage.setItem('customBankDisplayByAccount', JSON.stringify(newDisplayByAccount));
                    window.dispatchEvent(new Event('storage'));
                    setShowEditBankDisplay(false);
                    setEditingBankDisplayAccount(null);
                    showDeveloperMessage(`Saved for ${editingBankDisplayAccount.displayName}`);
                  }}
                  className="flex-1 py-2.5 bg-[#126987] text-white rounded-lg font-medium hover:bg-[#0f5a75] transition-colors text-sm"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <div className="modal-overlay bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Edit Account
                </h2>
                <button
                  onClick={() => {
                    setEditingAccount(null);
                    setNewBalance('');
                    setNewAccountName('');
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  {editingAccount.fullAccountNumber || editingAccount.accountNumber}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Account Name
                </label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                  placeholder={editingAccount.displayName}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Balance ({getCurrencySymbol(getUserCurrency())})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                  placeholder="Enter new balance"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setEditingAccount(null);
                    setNewBalance('');
                    setNewAccountName('');
                  }}
                  className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  onClick={updateBalance}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddAccount && (
        <div className="modal-overlay bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Add New Account
                </h2>
                <button
                  onClick={() => setShowAddAccount(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Account Type *
                  </label>
                  <select
                    value={newAccountData.accountType}
                    onChange={(e) => setNewAccountData({ ...newAccountData, accountType: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  >
                    <option value="current">Current Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="credit">Credit Card</option>
                    <option value="loan">Loan Account</option>
                    <option value="deposit">Deposit Account</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    A unique account number, sort code, IBAN & BIC will be generated automatically
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Custom Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={newAccountData.displayName}
                    onChange={(e) => setNewAccountData({ ...newAccountData, displayName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    placeholder={`e.g., "Holiday Savings" (defaults to "${
                      newAccountData.accountType === 'current' ? 'Current Account' :
                      newAccountData.accountType === 'savings' ? 'Savings Account' :
                      newAccountData.accountType === 'credit' ? 'Credit Card' :
                      newAccountData.accountType === 'loan' ? 'Loan Account' : 'Deposit Account'
                    }")`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Initial Balance ({userCurrency === 'EUR' ? '€' : '£'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAccountData.balance}
                    onChange={(e) => setNewAccountData({ ...newAccountData, balance: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowAddAccount(false)}
                  className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  onClick={addNewAccount}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteAccount && (
        <div className="modal-overlay bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-red-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Delete Account
                </h2>
                <button
                  onClick={() => {
                    setShowDeleteAccount(false);
                    setDeletingAccountId(null);
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Warning: Deleting an account will permanently remove all transactions associated with it. This action cannot be undone.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Select Account to Delete
                  </label>
                  <select
                    value={deletingAccountId || ''}
                    onChange={(e) => setDeletingAccountId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    data-testid="select-account-to-delete"
                  >
                    <option value="">Choose an account...</option>
                    {accounts && accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.displayName} - {formatCurrency(account.balance, userCurrency)}
                      </option>
                    ))}
                  </select>
                </div>

                {deletingAccountId && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-sm text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Are you sure you want to delete <strong>{accounts?.find(a => a.id === deletingAccountId)?.displayName}</strong>?
                    </p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowDeleteAccount(false);
                    setDeletingAccountId(null);
                  }}
                  className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!deletingAccountId) {
                      showDeveloperMessage('Please select an account to delete');
                      return;
                    }
                    
                    setIsDeleting(true);
                    try {
                      const response = await fetch(`/api/accounts/${deletingAccountId}`, {
                        method: 'DELETE',
                        credentials: 'include'
                      });
                      
                      const data = await response.json();
                      
                      if (response.ok && data.success) {
                        // Get updated accounts first (before filtering state)
                        const updatedAccounts = (accounts || []).filter(a => a.id !== deletingAccountId);
                        
                        // Update localStorage first for consistency
                        UserDataManager.setUserData('bankAccounts', updatedAccounts);
                        UserDataManager.clearCache('bankAccounts');
                        
                        // Also delete transactions for this account
                        const allTransactions = UserDataManager.getUserData('bankTransactions', []) || [];
                        const remainingTransactions = allTransactions.filter((tx: any) => tx.accountId !== deletingAccountId);
                        UserDataManager.setUserData('bankTransactions', remainingTransactions);
                        UserDataManager.clearCache('bankTransactions');
                        
                        // Update local accounts state
                        setAccounts(updatedAccounts);
                        
                        // Dispatch events to notify all components
                        window.dispatchEvent(new CustomEvent('accountsUpdate', {
                          detail: { accounts: updatedAccounts, source: 'accountDeleted' }
                        }));
                        window.dispatchEvent(new CustomEvent('balanceUpdate', {
                          detail: { accounts: updatedAccounts }
                        }));
                        window.dispatchEvent(new CustomEvent('transactionUpdate'));
                        
                        showDeveloperMessage(data.message || 'Account deleted successfully');
                        setShowDeleteAccount(false);
                        setDeletingAccountId(null);
                      } else {
                        showDeveloperMessage(data.message || 'Failed to delete account');
                      }
                    } catch (error) {
                      console.error('Error deleting account:', error);
                      showDeveloperMessage('Failed to delete account');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  disabled={!deletingAccountId || isDeleting}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
                    !deletingAccountId || isDeleting
                      ? 'bg-red-300 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                  data-testid="button-confirm-delete-account"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Transaction Modal */}
      {showAddTransaction && (
        <div className="modal-overlay bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Add Custom Transaction
                </h2>
                <button
                  onClick={() => {
                    setShowAddTransaction(false);
                    setCustomTransactionData({
                      accountId: '',
                      description: '',
                      amount: '',
                      type: 'debit',
                      date: new Date().toISOString().slice(0, 16)
                    });
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Account Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Select Account
                  </label>
                  <select
                    value={customTransactionData.accountId}
                    onChange={(e) => setCustomTransactionData({ ...customTransactionData, accountId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  >
                    <option value="">Choose an account...</option>
                    {accounts && Array.isArray(accounts) ? accounts.map((account) => (
                      <option key={account.id} value={account.id.toString()}>
                        {account.displayName} - {formatCurrency(account.balance, userCurrency)}
                      </option>
                    )) : null}
                  </select>
                </div>

                {/* Transaction Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Transaction Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setCustomTransactionData({ ...customTransactionData, type: 'debit' })}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        customTransactionData.type === 'debit'
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <p className={`font-semibold ${customTransactionData.type === 'debit' ? 'text-red-900' : 'text-gray-900'}`} style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        Debit
                      </p>
                      <p className={`text-xs ${customTransactionData.type === 'debit' ? 'text-red-600' : 'text-gray-500'}`} style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        Money Out
                      </p>
                    </button>
                    <button
                      onClick={() => setCustomTransactionData({ ...customTransactionData, type: 'credit' })}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        customTransactionData.type === 'credit'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <p className={`font-semibold ${customTransactionData.type === 'credit' ? 'text-green-900' : 'text-gray-900'}`} style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        Income
                      </p>
                      <p className={`text-xs ${customTransactionData.type === 'credit' ? 'text-green-600' : 'text-gray-500'}`} style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        Money In
                      </p>
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={customTransactionData.description}
                    onChange={(e) => setCustomTransactionData({ ...customTransactionData, description: e.target.value })}
                    placeholder="e.g., Salary Payment, Grocery Shopping"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Amount ({getCurrencySymbol(userCurrency)})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customTransactionData.amount}
                    onChange={(e) => setCustomTransactionData({ ...customTransactionData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  />
                </div>

                {/* Date & Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Transaction Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={customTransactionData.date}
                    onChange={(e) => setCustomTransactionData({ ...customTransactionData, date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddTransaction(false);
                    setCustomTransactionData({
                      accountId: '',
                      description: '',
                      amount: '',
                      type: 'debit',
                      date: new Date().toISOString().slice(0, 16)
                    });
                  }}
                  className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  onClick={addCustomTransaction}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Add Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sample Transactions Modal */}
      {showSampleTransactions && (
        <div className="modal-overlay bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto relative">
            {/* Loading Overlay */}
            {isAddingSampleTransactions && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-2xl">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Adding Sample Transactions...
                </p>
                <p className="text-sm text-gray-600 mt-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  {sampleTransactionProgress.current} of {sampleTransactionProgress.total} complete
                </p>
                <div className="w-48 h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${(sampleTransactionProgress.current / sampleTransactionProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Add Sample Transactions
                </h2>
                <button
                  onClick={() => !isAddingSampleTransactions && setShowSampleTransactions(false)}
                  disabled={isAddingSampleTransactions}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isAddingSampleTransactions ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <p className="text-gray-600 mb-6" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                Select date range, account, and number of transactions to add:
              </p>

              <div className="space-y-4">
                {/* Date Range Selection */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Transaction Date Range:
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        From Date:
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        style={{ fontFamily: 'OpenSans, sans-serif' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        To Date:
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        style={{ fontFamily: 'OpenSans, sans-serif' }}
                      />
                    </div>
                  </div>
                </div>
                {/* Account Selection */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Choose Account:
                  </h3>
                  <div className="space-y-2">
                    {accounts && Array.isArray(accounts) ? (
                      accounts.map((account) => (
                        <div key={account.id}>
                          <div className="bg-gray-50 p-3 rounded-xl border">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-left">
                                <p className="font-semibold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                                  {account.displayName}
                                </p>
                                <p className="text-sm text-gray-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                                  {account.accountNumber}
                                </p>
                                <p className="text-sm font-medium text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                                  Current: {formatCurrency(account.balance, userCurrency)}
                                </p>
                              </div>
                            </div>
                            
                            {/* Transaction Count Buttons */}
                            <div className="grid grid-cols-5 gap-2">
                              <button
                                onClick={() => addSampleTransactions(account.id, 1, startDate, endDate)}
                                className="flex flex-col items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded-lg active:scale-95 transition-transform hover:bg-blue-100"
                              >
                                <span className="text-sm font-bold text-blue-900">1</span>
                                <span className="text-xs text-blue-600">txn</span>
                              </button>
                              <button
                                onClick={() => addSampleTransactions(account.id, 5, startDate, endDate)}
                                className="flex flex-col items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded-lg active:scale-95 transition-transform hover:bg-blue-100"
                              >
                                <span className="text-sm font-bold text-blue-900">5</span>
                                <span className="text-xs text-blue-600">txns</span>
                              </button>
                              <button
                                onClick={() => addSampleTransactions(account.id, 10, startDate, endDate)}
                                className="flex flex-col items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded-lg active:scale-95 transition-transform hover:bg-blue-100"
                              >
                                <span className="text-sm font-bold text-blue-900">10</span>
                                <span className="text-xs text-blue-600">txns</span>
                              </button>
                              <button
                                onClick={() => addSampleTransactions(account.id, 20, startDate, endDate)}
                                className="flex flex-col items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded-lg active:scale-95 transition-transform hover:bg-blue-100"
                              >
                                <span className="text-sm font-bold text-blue-900">20</span>
                                <span className="text-xs text-blue-600">txns</span>
                              </button>
                              <button
                                onClick={() => addSampleTransactions(account.id, 50, startDate, endDate)}
                                className="flex flex-col items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded-lg active:scale-95 transition-transform hover:bg-blue-100"
                              >
                                <span className="text-sm font-bold text-blue-900">50</span>
                                <span className="text-xs text-blue-600">txns</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        No account data found
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => !isAddingSampleTransactions && setShowSampleTransactions(false)}
                  disabled={isAddingSampleTransactions}
                  className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                    isAddingSampleTransactions 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  {isAddingSampleTransactions ? 'Please wait...' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Transaction Modal */}
      {showDeleteTransaction && (
        <div className="admin-panel bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Delete Transaction
                </h2>
                <button
                  onClick={() => {
                    setShowDeleteTransaction(false);
                    setSelectedAccountId('');
                    setAccountTransactions([]);
                    setSelectedTransaction(null);
                    setTransactionSearchQuery('');
                  }}
                  data-testid="button-close-delete-transaction-modal"
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Step 1: Select Account */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    1. Select Account Type
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => {
                      setSelectedAccountId(e.target.value);
                      if (e.target.value) {
                        loadAccountTransactions(e.target.value);
                      } else {
                        setAccountTransactions([]);
                      }
                      setSelectedTransaction(null);
                      setTransactionSearchQuery('');
                    }}
                    data-testid="select-account-for-deletion"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  >
                    <option value="">Choose an account...</option>
                    {accounts && Array.isArray(accounts) ? accounts.map((account) => (
                      <option key={account.id} value={account.id.toString()}>
                        {account.accountType} - {formatCurrency(account.balance, userCurrency)}
                      </option>
                    )) : (
                      <option value="" disabled>No accounts available</option>
                    )}
                  </select>
                </div>

                {/* Step 2: Search and Filter Transactions */}
                {selectedAccountId && accountTransactions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      2. Search & Select Transaction ({accountTransactions.filter((tx: any) => {
                        const searchLower = transactionSearchQuery.toLowerCase();
                        return tx.description.toLowerCase().includes(searchLower) ||
                          (tx.reference && tx.reference.toLowerCase().includes(searchLower)) ||
                          (tx.recipientName && tx.recipientName.toLowerCase().includes(searchLower)) ||
                          tx.amount.toString().includes(searchLower);
                      }).length} of {accountTransactions.length} transactions)
                    </label>
                    
                    {/* Search Box */}
                    <div className="mb-3">
                      <input
                        type="text"
                        value={transactionSearchQuery}
                        onChange={(e) => setTransactionSearchQuery(e.target.value)}
                        placeholder="Search by description, reference, recipient, or amount..."
                        data-testid="input-search-transactions"
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        style={{ fontFamily: 'OpenSans, sans-serif' }}
                      />
                    </div>

                    <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-xl">
                      {accountTransactions.filter((tx: any) => {
                        const searchLower = transactionSearchQuery.toLowerCase();
                        return tx.description.toLowerCase().includes(searchLower) ||
                          (tx.reference && tx.reference.toLowerCase().includes(searchLower)) ||
                          (tx.recipientName && tx.recipientName.toLowerCase().includes(searchLower)) ||
                          tx.amount.toString().includes(searchLower);
                      }).map((transaction, index) => (
                        <div
                          key={transaction.id}
                          data-testid={`transaction-item-${transaction.id}`}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                            selectedTransaction?.id === transaction.id ? 'bg-red-50 border-2 border-red-300 shadow-md' : ''
                          }`}
                          onClick={() => setSelectedTransaction(transaction)}
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                              {/* Date - Made more prominent */}
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                                  {new Date(transaction.timestamp).toLocaleDateString('en-GB', { 
                                    day: '2-digit', 
                                    month: 'short', 
                                    year: 'numeric' 
                                  })}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(transaction.timestamp).toLocaleTimeString('en-GB', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                              </div>
                              
                              {/* Payment Method Badge */}
                              <div className="mb-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  transaction.paymentMethod === 'UK Transfer' ? 'bg-blue-100 text-blue-800' :
                                  transaction.paymentMethod === 'SEPA Transfer' ? 'bg-green-100 text-green-800' :
                                  transaction.paymentMethod === 'BOI Transfer' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {transaction.paymentMethod || 'Other'}
                                </span>
                              </div>
                              
                              {/* Description */}
                              <p className="font-semibold text-gray-900 mb-1 truncate" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                                {transaction.description}
                              </p>
                              
                              {/* Reference and Recipient */}
                              <div className="space-y-1">
                                {transaction.reference && (
                                  <p className="text-sm text-gray-600 truncate" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                                    Ref: {transaction.reference}
                                  </p>
                                )}
                                {transaction.recipientName && (
                                  <p className="text-sm text-gray-600 truncate" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                                    To: {transaction.recipientName}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {/* Amount and Delete Button */}
                            <div className="text-right flex flex-col items-end justify-between space-y-2 flex-shrink-0">
                              <div>
                                <p className={`font-bold text-lg whitespace-nowrap ${
                                  transaction.amount.startsWith('-') ? 'text-red-600' : 'text-green-600'
                                }`} style={{ fontFamily: 'OpenSans, sans-serif' }}>
                                  {formatCurrency(Math.abs(parseFloat(transaction.amount)), userCurrency)}
                                </p>
                                <p className="text-xs text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                                  {transaction.amount.startsWith('-') ? 'Debit' : 'Credit'}
                                </p>
                              </div>
                              {selectedTransaction?.id === transaction.id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteConfirm(true);
                                  }}
                                  data-testid="button-confirm-delete-transaction"
                                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm active:scale-95"
                                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAccountId && accountTransactions.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      No transactions found for this account.
                    </p>
                  </div>
                )}

                {/* Instructions */}
                {selectedAccountId && accountTransactions.length > 0 && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                    <p className="text-sm text-blue-900 font-medium mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      <strong>✨ Quick Guide:</strong>
                    </p>
                    <ul className="text-sm text-blue-800 space-y-1 ml-4" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      <li>• Latest transactions appear first at the top</li>
                      <li>• Use the search box to filter by description, reference, recipient, or amount</li>
                      <li>• Click any transaction to select it - it will highlight in red</li>
                      <li>• Click the Delete button to remove the transaction</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedTransaction && (
        <div className="admin-panel bg-black bg-opacity-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                Confirm Transaction Deletion
              </h3>
              <p className="text-gray-600 mb-6" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                Are you sure you want to delete this transaction? This action cannot be undone and will update the account balance accordingly.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  data-testid="button-cancel-delete-confirmation"
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-xl font-medium hover:bg-gray-300 transition-colors active:scale-95"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTransaction}
                  data-testid="button-final-delete-transaction"
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors active:scale-95"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Delete Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Personal Details Modal */}
      {showPersonalDetails && (
        <div 
          className="admin-panel bg-black bg-opacity-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPersonalDetails(false);
            }
          }}
        >
          <div 
            className="bg-white w-full h-full flex flex-col modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
            <div className="flex-shrink-0 bg-[#126987] text-white px-4 py-4 flex items-center justify-between">
              <button
                onClick={() => setShowPersonalDetails(false)}
                className="p-1 -ml-1"
                data-testid="button-close-personal-details"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <h1 className="text-lg font-semibold" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                Personal Details
              </h1>
              <button
                onClick={() => setShowPersonalDetails(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                data-testid="button-profile-close-personal-details"
              >
                <User className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto bg-white">
              {isLoadingPersonalDetails ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
                  <div className="w-16 h-16 border-4 border-gray-200 border-t-[#126987] rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>Loading personal details...</p>
                </div>
              ) : (
                <div className="mx-4 mt-6 pb-6">
                  {/* Name */}
                  <div className="border border-gray-200 rounded px-4 py-4 mb-3" style={{ minHeight: '70px', borderRadius: '4px' }}>
                    <p className="text-gray-800 text-base font-normal" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Name
                    </p>
                    <p className="text-gray-500 text-sm mt-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      {profileData.name || '-'}
                    </p>
                  </div>

                  {/* Date of Birth */}
                  <div className="border border-gray-200 rounded px-4 py-4 mb-3" style={{ minHeight: '70px', borderRadius: '4px' }}>
                    <p className="text-gray-800 text-base font-normal" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Date of birth
                    </p>
                    <p className="text-gray-500 text-sm mt-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      {profileData.dateOfBirth || '-'}
                    </p>
                  </div>

                  {/* Address */}
                  <div className="border border-gray-200 rounded px-4 py-4 mb-3" style={{ minHeight: '70px', borderRadius: '4px' }}>
                    <p className="text-gray-800 text-base font-normal" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Address
                    </p>
                    <p className="text-gray-500 text-sm mt-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      {profileData.address || '-'}
                    </p>
                  </div>

                  {/* Phone */}
                  <div className="border border-gray-200 rounded px-4 py-4 mb-3" style={{ minHeight: '70px', borderRadius: '4px' }}>
                    <p className="text-gray-800 text-base font-normal" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Mobile number
                    </p>
                    <p className="text-gray-500 text-sm mt-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      {profileData.phone || '-'}
                    </p>
                  </div>

                  {/* Member Since */}
                  <div className="border border-gray-200 rounded px-4 py-4 mb-3" style={{ minHeight: '70px', borderRadius: '4px' }}>
                    <p className="text-gray-800 text-base font-normal" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Member since
                    </p>
                    <p className="text-gray-500 text-sm mt-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      {profileData.joinDate || '-'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* My Security Devices Modal */}
      {showSecurityDevices && (
        <div 
          className="admin-panel bg-black bg-opacity-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSecurityDevices(false);
            }
          }}
        >
          <div 
            className="bg-white w-full h-full flex flex-col modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 bg-[#126987] text-white px-4 py-4 flex items-center justify-between">
              <button
                onClick={() => setShowSecurityDevices(false)}
                className="p-1 -ml-1"
                data-testid="button-close-security-devices"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <h1 className="text-lg font-semibold" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                My Security Devices
              </h1>
              <button
                onClick={() => setShowSecurityDevices(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                data-testid="button-profile-close-security-devices"
              >
                <User className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              {isLoadingSecurityDevices ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
                  <div className="w-16 h-16 border-4 border-gray-200 border-t-[#126987] rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>Loading security devices...</p>
                </div>
              ) : (
                <div className="pb-6">
                  {/* Primary device info box */}
                  <div className="mx-4 mt-6 flex items-start gap-3 p-4 bg-gray-50 rounded" style={{ borderRadius: '4px' }}>
                    <div className="flex-shrink-0 mt-1">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#126987" strokeWidth="1.5">
                        <rect x="5" y="2" width="14" height="20" rx="2" />
                        <circle cx="12" cy="18" r="1" fill="#126987" />
                        <path d="M15 1C16.5 2 17.5 3.5 17.5 5" stroke="#126987" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M18 0C20 1.5 21.5 4 21.5 6.5" stroke="#126987" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        <span className="text-[#126987] font-semibold">Primary device:</span> Required whenever additional security is needed for card purchases online.{' '}
                        <span className="text-[#126987] underline cursor-pointer">More about this</span>
                      </p>
                    </div>
                  </div>

                  {/* Manage devices section */}
                  <div className="mx-4 mt-6">
                    <h2 className="text-gray-900 text-lg font-semibold mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Manage devices
                    </h2>
                    <p className="text-gray-600 text-sm mb-4" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Tap on any device listed here to block or unblock it, rename it or remove it from your profile.
                    </p>

                    {/* Device card */}
                    <div className="border border-gray-200 rounded p-4 flex items-center justify-between" style={{ borderRadius: '4px' }}>
                      <div className="flex items-center gap-3">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#126987" strokeWidth="1.5">
                          <rect x="5" y="2" width="14" height="20" rx="2" />
                          <circle cx="12" cy="18" r="1" fill="#126987" />
                        </svg>
                        <div>
                          <p className="text-gray-900 font-semibold text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                            This Phone
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-green-600 text-sm font-medium" style={{ fontFamily: 'OpenSans, sans-serif' }}>Active</span>
                            <span className="bg-blue-100 text-[#0d4e63] text-xs font-bold px-2 py-0.5 rounded" style={{ fontFamily: 'OpenSans, sans-serif' }}>PRIMARY</span>
                            <span className="text-gray-500 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>(Now being used)</span>
                          </div>
                        </div>
                      </div>
                      <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                    </div>
                  </div>

                  {/* Adding another device section */}
                  <div className="mx-4 mt-6">
                    <h2 className="text-gray-900 text-lg font-semibold mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Adding another device
                    </h2>
                    <p className="text-gray-600 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      You can also access your online banking profile through other smartphones or tablets.{' '}
                      <span className="text-[#126987] underline cursor-pointer">More about this</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Face ID Modal */}
      {showFaceId && (
        <div 
          className="admin-panel bg-black bg-opacity-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowFaceId(false);
            }
          }}
        >
          <div 
            className="bg-white w-full h-full flex flex-col modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 bg-[#126987] text-white px-4 py-4 flex items-center justify-between">
              <button
                onClick={() => setShowFaceId(false)}
                className="p-1 -ml-1"
                data-testid="button-close-face-id"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <h1 className="text-lg font-semibold" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                Face ID
              </h1>
              <button
                onClick={() => setShowFaceId(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                data-testid="button-profile-close-face-id"
              >
                <User className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              {isLoadingFaceId ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
                  <div className="w-16 h-16 border-4 border-gray-200 border-t-[#126987] rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>Loading Face ID settings...</p>
                </div>
              ) : (
                <div className="pb-6">
                  {/* Info box */}
                  <div className="mx-4 mt-6 flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#126987] flex items-center justify-center mt-0.5">
                      <span className="text-white text-sm font-bold">i</span>
                    </div>
                    <p className="text-gray-700 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      When you enable Face ID, it will become the standard way to log in. Now and again, for security reasons, we may still ask you to log in using your PIN.
                    </p>
                  </div>

                  {/* Enable Face ID toggle */}
                  <div className="mx-4 mt-6 border border-gray-200 rounded p-4 flex items-center justify-between" style={{ borderRadius: '4px' }}>
                    <span className="text-gray-900 font-semibold text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Enable Face ID
                    </span>
                    {isRegisteringFaceId ? (
                      <div className="w-14 h-8 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-gray-300 border-t-[#126987] rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleFaceIdToggle(!faceIdEnabled)}
                        className={`relative w-14 h-8 rounded-full transition-colors ${faceIdEnabled ? 'bg-[#126987]' : 'bg-gray-300'}`}
                        data-testid="toggle-face-id"
                      >
                        <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${faceIdEnabled ? 'right-1' : 'left-1'}`}></span>
                        {faceIdEnabled && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-xs font-medium">On</span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Security warning */}
                  <div className="mx-4 mt-6">
                    <p className="text-gray-700 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Anyone whose biometrics have been added to this device could use that data to log in to your BoI profile. We recommend deleting any biometric data that is not your own from this device.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Open Banking Connections Modal */}
      {showOpenBanking && (
        <div 
          className="admin-panel bg-black bg-opacity-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowOpenBanking(false);
            }
          }}
        >
          <div 
            className="bg-white w-full h-full flex flex-col modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 bg-[#126987] text-white px-4 py-4 flex items-center justify-between">
              <button
                onClick={() => setShowOpenBanking(false)}
                className="p-1 -ml-1"
                data-testid="button-close-open-banking"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <h1 className="text-lg font-semibold" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                Open Banking Connections
              </h1>
              <button
                onClick={() => setShowOpenBanking(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                data-testid="button-profile-close-open-banking"
              >
                <User className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              {isLoadingOpenBanking ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
                  <div className="w-16 h-16 border-4 border-gray-200 border-t-[#126987] rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>Loading open banking...</p>
                </div>
              ) : (
                <div className="pb-6">
                  {/* Description text */}
                  <p className="mx-4 mt-6 text-gray-700 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    From here you have control of any connections that you've made through open banking.
                  </p>

                  {/* Data sharing button */}
                  <button 
                    className="mx-auto mt-6 flex items-center justify-between px-4 py-4 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                    style={{ borderRadius: '4px', width: 'calc(100% - 32px)', maxWidth: '361px' }}
                    data-testid="button-data-sharing"
                  >
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Data sharing
                    </span>
                    <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                  </button>

                  {/* Confirmation of funds button */}
                  <button 
                    className="mx-auto mt-3 flex items-center justify-between px-4 py-4 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                    style={{ borderRadius: '4px', width: 'calc(100% - 32px)', maxWidth: '361px' }}
                    data-testid="button-confirmation-funds"
                  >
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Confirmation of funds
                    </span>
                    <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Privacy and Preferences Modal */}
      {showPrivacy && (
        <div 
          className="admin-panel bg-black bg-opacity-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPrivacy(false);
            }
          }}
        >
          <div 
            className="bg-white w-full h-full flex flex-col modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 bg-[#126987] text-white px-4 py-4 flex items-center justify-between">
              <button
                onClick={() => setShowPrivacy(false)}
                className="p-1 -ml-1"
                data-testid="button-close-privacy"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <h1 className="text-lg font-semibold" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                Privacy and Preferences
              </h1>
              <button
                onClick={() => setShowPrivacy(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                data-testid="button-profile-close-privacy"
              >
                <User className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              {isLoadingPrivacy ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
                  <div className="w-16 h-16 border-4 border-gray-200 border-t-[#126987] rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>Loading privacy settings...</p>
                </div>
              ) : (
                <div className="pb-6">
                  {/* Manage cookie settings button */}
                  <button 
                    className="mx-auto mt-6 flex items-center justify-between px-4 py-4 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                    style={{ borderRadius: '4px', width: 'calc(100% - 32px)', maxWidth: '361px' }}
                    data-testid="button-manage-cookies"
                  >
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Manage cookie settings
                    </span>
                    <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                  </button>

                  {/* Data Privacy Notice button */}
                  <button 
                    className="mx-auto mt-3 flex items-center justify-between px-4 py-4 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                    style={{ borderRadius: '4px', width: 'calc(100% - 32px)', maxWidth: '361px' }}
                    data-testid="button-data-privacy"
                  >
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Data Privacy Notice
                    </span>
                    <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Security and Legal Modal */}
      {showSecurityLegal && (
        <div 
          className="admin-panel bg-black bg-opacity-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSecurityLegal(false);
            }
          }}
        >
          <div 
            className="bg-white w-full h-full flex flex-col modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 bg-[#126987] text-white px-4 py-4 flex items-center justify-between">
              <button
                onClick={() => setShowSecurityLegal(false)}
                className="p-1 -ml-1"
                data-testid="button-close-security-legal"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <h1 className="text-lg font-semibold" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                Security and Legal
              </h1>
              <button
                onClick={() => setShowSecurityLegal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                data-testid="button-profile-close-security-legal"
              >
                <User className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              {isLoadingSecurityLegal ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
                  <div className="w-16 h-16 border-4 border-gray-200 border-t-[#126987] rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>Loading security settings...</p>
                </div>
              ) : (
                <div className="pb-6">
                  {/* Security button */}
                  <button 
                    className="mx-auto mt-6 flex items-center justify-between px-4 py-4 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                    style={{ borderRadius: '4px', width: 'calc(100% - 32px)', maxWidth: '361px' }}
                    data-testid="button-security"
                  >
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Security
                    </span>
                    <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                  </button>

                  {/* Terms & Conditions button */}
                  <button 
                    className="mx-auto mt-3 flex items-center justify-between px-4 py-4 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                    style={{ borderRadius: '4px', width: 'calc(100% - 32px)', maxWidth: '361px' }}
                    data-testid="button-terms"
                  >
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Terms & Conditions
                    </span>
                    <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                  </button>

                  {/* Regulatory information button */}
                  <button 
                    className="mx-auto mt-3 flex items-center justify-between px-4 py-4 bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                    style={{ borderRadius: '4px', width: 'calc(100% - 32px)', maxWidth: '361px' }}
                    data-testid="button-regulatory"
                  >
                    <span className="text-gray-800 font-normal text-base" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Regulatory information
                    </span>
                    <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                  </button>

                  {/* Regulatory text */}
                  <div className="mx-4 mt-6">
                    <p className="text-gray-700 text-sm text-center leading-relaxed" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Bank of Ireland is regulated by the Central Bank of Ireland. Bank of Ireland trading as The Mortgage Store - powered by Bank of Ireland is regulated by the Central Bank of Ireland. Bank of Ireland (UK) plc is authorised by the Prudential Regulation Authority and regulated by the Financial Conduct Authority and the Prudential Regulation Authority. Bank of Ireland Life is a trading name of New Ireland Assurance Company plc. New Ireland Assurance Company plc trading as Bank of Ireland Life is regulated by the Central Bank of Ireland. Life assurance and pension products are provided by New Ireland Assurance Company plc trading as Bank of Ireland Life. Bank of Ireland is a tied agent of New Ireland Assurance Company plc trading as Bank of Ireland Life for life assurance and pensions business. Bank of Ireland Mortgage Bank U.C. trading as Bank of Ireland Mortgages is regulated by the Central Bank of Ireland.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}