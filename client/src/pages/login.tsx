import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { User, ExternalLink, HelpCircle, Phone, Settings, Shield, MapPin, MoreHorizontal } from "lucide-react";
import { UserDataManager } from "@/utils/userDataManager";
import { getUserCurrency } from "@/utils/currencyUtils";
import { promptNotificationsAtCreation } from "@/utils/notifications";
import { applyThemeColor } from "@/utils/themeColor";
import ukLogoPath from "@assets/IMG_1505_1759859367310.png";
import faceIdIconPath from "@assets/IMG_1506_1759859583184.png";


export default function Login() {
  const [customerNumber, setCustomerNumber] = useState("");
  const [pin, setPin] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [holdTimer, setHoldTimer] = useState<NodeJS.Timeout | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isLoginAnimating, setIsLoginAnimating] = useState(false);
  const [loginProgress, setLoginProgress] = useState(0);
  const [loginStage, setLoginStage] = useState('');
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [signUpStep, setSignUpStep] = useState<'initial' | 'form'>('initial');
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    phone: '',
    customerNumber: ''
  });
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showOtcVerification, setShowOtcVerification] = useState(false);
  const [otcCode, setOtcCode] = useState('');
  const [generatedOtc, setGeneratedOtc] = useState('');
  const [pendingAccountData, setPendingAccountData] = useState<any>(null);
  const [showATMLocator, setShowATMLocator] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [nearbyATMs, setNearbyATMs] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [offlineStatus, setOfflineStatus] = useState<{hasOfflineAccess: boolean; timeRemaining?: string} | null>(null);
  const [userCurrency, setUserCurrency] = useState<'EUR' | 'GBP'>(() => getUserCurrency());
  const [faceIdEnabled, setFaceIdEnabled] = useState(() => {
    const saved = localStorage.getItem('faceIdEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [showDeviceLockModal, setShowDeviceLockModal] = useState(false);
  const [showNotificationPermissionModal, setShowNotificationPermissionModal] = useState(false);
  const [notificationDenied, setNotificationDenied] = useState(false);
  
  // Input refs for proper focus management in PWA
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  
  const authHook = useAuth();
  const login = authHook?.login || (() => {});
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    // Ensure theme-color is set for main app screens
    applyThemeColor();
  }, []);

  const locationHook = useLocation();
  const [, navigate] = locationHook || [null, () => {}];
  const [validatedUsers, setValidatedUsers] = useState<any>({});
  
  const toast = (_options?: any) => {}; // No-op function to replace all toast notifications

  // Listen for Face ID setting changes
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('faceIdEnabled');
      if (saved !== null) {
        setFaceIdEnabled(JSON.parse(saved));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Check for account revoked message in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    
    if (message === 'account_revoked') {
      toast({
        title: "Account Access Revoked",
        description: "Your account has been removed. Please create a new account to continue.",
        variant: "destructive",
        duration: 8000,
      });
      
      // Clear the message parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  // Check connection status and offline login availability
  const checkConnectionAndOfflineStatus = async () => {
    try {
      const { SecureAuthManager } = await import('../utils/secureAuthManager');
      
      // Check internet connectivity
      const hasInternet = await SecureAuthManager.hasInternetConnection();
      setConnectionStatus(hasInternet ? 'online' : 'offline');
      
      // Check offline login status for current user
      const currentUser = UserDataManager.getCurrentUser();
      if (currentUser) {
        const offlineStatus = SecureAuthManager.getOfflineLoginStatus(currentUser);
        setOfflineStatus(offlineStatus);
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
      setConnectionStatus('unknown');
    }
  };

  // Secure: Save only the logged-in user's data to localStorage (for Face ID)
  const saveAuthenticatedUserData = (customerNumber: string, userProfile: any) => {
    try {
      // Save only this user's data to localStorage for Face ID
      const existingUsers = JSON.parse(localStorage.getItem('bankUsers') || '{}');
      existingUsers[customerNumber] = {
        customerNumber: customerNumber,
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone || null,
        address: userProfile.address || null,
        currency: userProfile.currency || 'EUR',
        dateOfBirth: userProfile.dateOfBirth || null,
        joinDate: userProfile.joinDate || 'Member since 2018'
      };
      localStorage.setItem('bankUsers', JSON.stringify(existingUsers));
      console.log(`✅ Saved user ${customerNumber} to localStorage for Face ID`);
    } catch (error) {
      console.error('Failed to save user data to localStorage:', error);
    }
  };

  // Validate users against server and clean up deleted ones
  const validateAndCleanUsers = async () => {
    const cachedUsers = UserDataManager.getAllUsers();
    setValidatedUsers(cachedUsers); // Use cached users immediately, validate in background
  };



  // Reset form state when modal opens to ensure clean mounting
  const resetSignUpForm = () => {
    setNewUserData({
      name: '',
      email: '',
      phone: '',
      customerNumber: ''
    });
    setSignUpStep('initial');
    // Clear any stale focus states
    setTimeout(() => {
      [nameInputRef, emailInputRef, phoneInputRef].forEach(ref => {
        if (ref.current) {
          ref.current.blur();
        }
      });
    }, 50);
  };

  // PWA Modal Focus Management - Ensures proper input mounting
  useEffect(() => {
    if (showSignUp) {
      // Force DOM reflow and ensure inputs are properly mounted
      setTimeout(() => {
        const inputs = [nameInputRef, emailInputRef, phoneInputRef];
        inputs.forEach(ref => {
          if (ref.current) {
            // Remove any readonly or disabled states
            ref.current.removeAttribute('readonly');
            ref.current.removeAttribute('disabled');
            // Ensure proper touch handling
            ref.current.style.pointerEvents = 'auto';
            ref.current.style.touchAction = 'manipulation';
          }
        });
      }, 200);
    }
  }, [showSignUp]);

  // Assets are always loaded - no delays
  useEffect(() => {
    setAssetsLoaded(true);
    
    // Security: Do NOT sync all users on page load - only save data after authentication
    
    // Check if this is a fresh app installation (no permanent login state)
    const hasPermanentLogin = localStorage.getItem('bankingUser') || localStorage.getItem('lastActiveUser');
    
    // Only clear auth data if no permanent login exists and user explicitly logged out
    if (!hasPermanentLogin && localStorage.getItem('explicit_logout') === 'true') {
      localStorage.removeItem('explicit_logout');
      // Auth data already cleared
    }
    
    // Clear form fields regardless
    setCustomerNumber('');
    setPin('');
    setBiometricVerified(false);
    setPinVerified(false);
    setLogoTapCount(0);
  }, []);


  const handleNavigation = (path: string) => {
    setIsNavigating(true);
    setTimeout(() => {
      navigate(path);
    }, 150);
  };

  const handleLogoTap = () => {
    // Check if user is authenticated - if so, disable the 5-tap trigger
    const currentUser = UserDataManager.getCurrentUser();
    if (currentUser) {
      return; // Do nothing if user is logged in
    }
    
    const newTapCount = logoTapCount + 1;
    setLogoTapCount(newTapCount);
    
    if (newTapCount === 5) {
      // Open the signup modal directly when 5 taps detected
      resetSignUpForm();
      setShowSignUp(true);
      setSignUpStep('initial');
      setLogoTapCount(0);
      return;
    }
    
    // Reset tap count after 3 seconds of inactivity with cleanup
    const timeoutId = setTimeout(() => {
      setLogoTapCount(0);
    }, 3000);
    
    // Store timeout ID for potential cleanup
    return () => clearTimeout(timeoutId);
  };

  const generateCustomerNumber = () => {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  };

  const generateSecurePin = () => {
    // Generate a secure 4-digit PIN
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const handleSignUp = async () => {
    if (!newUserData.name || !newUserData.email || !newUserData.phone) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const customerNumber = generateCustomerNumber();
    const generatedPin = generateSecurePin();
    const userData = {
      ...newUserData,
      customerNumber,
      pin: generatedPin,
      joinDate: new Date().toISOString(),
      dateCreated: new Date().toISOString(),
      address: "New Customer Address",
      dateOfBirth: "01 January 1990"
    };

    // Generate and send OTC for admin verification
    try {
      const response = await fetch('/api/admin/generate-otc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerNumber: userData.customerNumber,
          name: userData.name,
          email: userData.email,
          phone: userData.phone
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        
        // Store pending account data
        setPendingAccountData(userData);
        
        // Show OTC verification screen
        setShowSignUp(false);
        setShowOtcVerification(true);
        
        toast({
          title: "Verification Required",
          description: "An admin verification code has been generated. Please enter the OTC to complete account creation.",
          duration: 6000,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate verification code. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRequestLocationPermission = async () => {
    // Request location permission
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log('Location permission granted');
          
          // Send location to server for admin tracking
          try {
            const customerNumber = pendingAccountData?.customerNumber;
            if (customerNumber) {
              await fetch('/api/customers/update-location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customerNumber,
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude
                })
              });
            }
          } catch (error) {
            console.log('Failed to update location:', error);
          }
        },
        (error) => {
          console.log('Location permission denied');
        }
      );
    }
  };

  const handleOtcVerification = async () => {
    if (!otcCode || otcCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }

    if (!pendingAccountData) {
      toast({
        title: "Error",
        description: "No pending account data found. Please try creating the account again.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate OTC with server
      const response = await fetch('/api/admin/validate-otc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerNumber: pendingAccountData.customerNumber,
          code: otcCode
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // OTC is valid, create the account
        await UserDataManager.registerUser(pendingAccountData);
        UserDataManager.initializeFreshAccount(pendingAccountData.customerNumber);

        // Save new user's data to localStorage for Face ID
        const userProfile = UserDataManager.getUserProfile();
        if (userProfile) {
          saveAuthenticatedUserData(pendingAccountData.customerNumber, userProfile);
        }

        toast({
          title: "Account Created Successfully",
          description: `Your customer number is ${pendingAccountData.customerNumber} and your PIN is ${pendingAccountData.pin}. Please save these credentials for login.`,
          duration: 8000,
        });

        // Clean up state
        setShowOtcVerification(false);
        setOtcCode('');
        setNewUserData({ name: '', email: '', phone: '', customerNumber: '' });
        setCustomerNumber(pendingAccountData.customerNumber);

        // Show device lock modal first
        setShowDeviceLockModal(true);

      } else {
        // OTC validation failed
        toast({
          title: "Invalid Verification Code",
          description: result.message || "The verification code is invalid or has expired. Please try again.",
          variant: "destructive",
        });
      }

    } catch (error) {
      toast({
        title: "Verification Failed",
        description: "Unable to verify the code. Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user exists
    if (!UserDataManager.userExists(customerNumber)) {
      toast({
        title: "Login Failed",
        description: "Customer number not found. Please check your credentials or create a new account.",
        variant: "destructive",
      });
      return;
    }

    // Check if account has been deleted from database
    try {
      const response = await fetch(`/api/profile/${customerNumber}`, {
        credentials: 'include'
      });
      
      if (response.status === 410) {
        // Account deleted
        alert('Account Deleted');
        UserDataManager.removeUser(customerNumber);
        return;
      }
      
      if (!response.ok) {
        toast({
          title: "Account Not Found",
          description: "This account no longer exists.",
          variant: "destructive",
        });
        UserDataManager.removeUser(customerNumber);
        return;
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to verify account status.",
        variant: "destructive",
      });
      return;
    }

    // Set current user and record login time
    UserDataManager.setCurrentUser(customerNumber);
    UserDataManager.recordLoginTime(customerNumber);
    
    try {
      const userProfile = UserDataManager.getUserProfile();
      if (userProfile) {
        login({
          id: parseInt(customerNumber.replace(/\D/g, '')) || 1,
          name: userProfile.name,
          email: userProfile.email,
          customerNumber: customerNumber
        });
      }
      
      // Clear cold start flag - user has successfully logged in
      localStorage.removeItem('cold_start_active');
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "Invalid customer number or PIN. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBiometricHoldStart = async (e?: React.TouchEvent | React.MouseEvent) => {
    if (biometricVerified || isScanning) return;
    
    // Prevent default touch behavior to avoid accidental scrolling
    if (e) {
      e.preventDefault();
    }
    
    // Check if any users exist first
    const allUsers = UserDataManager.getAllUsers();
    if (Object.keys(allUsers).length === 0) {
      toast({
        title: "No Account Found",
        description: "Please create an account first by tapping 'Waiting for approval'.",
        variant: "destructive",
      });
      return;
    }

    // Determine target user before starting scan
    let targetUser = null;
    if (customerNumber && UserDataManager.userExists(customerNumber)) {
      targetUser = customerNumber;
    } else if (!customerNumber) {
      const lastActiveUser = UserDataManager.getLastActiveUser();
      if (lastActiveUser && UserDataManager.userExists(lastActiveUser)) {
        targetUser = lastActiveUser;
      } else {
        const userNumbers = Object.keys(allUsers);
        if (userNumbers.length > 0) {
          targetUser = userNumbers[0]; // Use first available user
        }
      }
    }

    if (!targetUser) {
      toast({
        title: "Account Not Found",
        description: "No valid account found. Please check your credentials.",
        variant: "destructive",
      });
      return;
    }

    // Face ID flow - trigger browser biometric authentication
    if (faceIdEnabled) {
      setIsScanning(true);
      
      try {
        // Check if passkey is registered
        const credentialId = localStorage.getItem('faceIdCredentialId');
        
        // Check if Web Authentication API is available
        if (window.PublicKeyCredential && credentialId && !credentialId.startsWith('fallback-')) {
          try {
            // Use stored passkey for authentication
            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);

            const publicKeyCredentialRequestOptions = {
              challenge,
              rpId: window.location.hostname,
              allowCredentials: [{
                id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
                type: "public-key" as const,
              }],
              userVerification: "required" as const,
              timeout: 60000,
            };

            // Trigger Face ID / Touch ID authentication with stored passkey
            await navigator.credentials.get({
              publicKey: publicKeyCredentialRequestOptions
            });

            // Success - Face ID verified
            setBiometricVerified(true);
            setIsScanning(false);
            
            // Set user and initialize account
            UserDataManager.setCurrentUser(targetUser);
            UserDataManager.initializeFreshAccount(targetUser);
            if (!customerNumber) {
              setCustomerNumber(targetUser);
            }

            return;
          } catch (webAuthnError) {
            // WebAuthn failed or was cancelled
            setIsScanning(false);
            toast({
              title: "Face ID Cancelled",
              description: "Authentication was cancelled",
              variant: "destructive",
            });
            return;
          }
        }
        
        // Fallback: Simulate Face ID authentication for browsers without WebAuthn or passkey
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Success - Face ID verified
        setBiometricVerified(true);
        setIsScanning(false);
        
        // Set user and initialize account
        UserDataManager.setCurrentUser(targetUser);
        UserDataManager.initializeFreshAccount(targetUser);
        if (!customerNumber) {
          setCustomerNumber(targetUser);
        }
      } catch (error) {
        setIsScanning(false);
        toast({
          title: "Face ID Failed",
          description: "Authentication failed",
          variant: "destructive",
        });
      }
      return;
    }
    
    // Fingerprint flow - MUST hold for full 4 seconds
    setIsScanning(true);
    setHoldProgress(0);
    
    let progressCount = 0;
    const totalSteps = 80; // 80 steps over 4 seconds (50ms intervals)
    
    const timer = setInterval(() => {
      progressCount++;
      const newProgress = (progressCount / totalSteps) * 100;
      
      setHoldProgress(newProgress);
      
      // Only authenticate when timer completes the full 4 seconds
      if (progressCount >= totalSteps) {
        clearInterval(timer);
        setBiometricVerified(true);
        setIsScanning(false);
        setHoldProgress(0);
        setHoldTimer(null);
        
        // Set user and initialize account
        UserDataManager.setCurrentUser(targetUser);
        UserDataManager.initializeFreshAccount(targetUser);
        if (!customerNumber) {
          setCustomerNumber(targetUser);
        }
      }
    }, 50);
    
    setHoldTimer(timer);
  };

  const handleBiometricHoldEnd = () => {
    // Clear the interval if user releases early
    if (holdTimer) {
      clearInterval(holdTimer);
      setHoldTimer(null);
    }
    // Reset scanning state immediately when user releases - CANCEL authentication
    if (isScanning && !biometricVerified) {
      setIsScanning(false);
      setHoldProgress(0);
    }
  };

  const handleLoginButton = async () => {
    // Prevent multiple clicks while already processing
    if (isLoading || isLoginAnimating) {
      return;
    }
    
    if (!biometricVerified && !pinVerified) {
      toast({
        title: "Authentication Required",
        description: "Please verify with biometric or PIN first",
        variant: "destructive",
      });
      return;
    }

    // Get current user for authentication
    const currentUser = UserDataManager.getCurrentUser();
    if (!currentUser) {
      toast({
        title: "Authentication Error",
        description: "No user selected for login",
        variant: "destructive",
      });
      return;
    }

    // Check if account has been deleted from database AND fetch fresh profile data
    let freshUserProfile;
    try {
      const response = await fetch(`/api/profile/${currentUser}`, {
        credentials: 'include'
      });
      
      if (response.status === 410) {
        // Account deleted
        alert('Account Deleted');
        UserDataManager.removeUser(currentUser);
        setBiometricVerified(false);
        setPinVerified(false);
        return;
      }
      
      if (!response.ok) {
        toast({
          title: "Account Not Found",
          description: "This account no longer exists.",
          variant: "destructive",
        });
        UserDataManager.removeUser(currentUser);
        setBiometricVerified(false);
        setPinVerified(false);
        return;
      }
      
      // Get fresh profile data from database (source of truth)
      freshUserProfile = await response.json();
      
      // CRITICAL: Update localStorage with fresh database data immediately
      // This ensures restored users get their current name, not cached old name
      const allUsers = JSON.parse(localStorage.getItem('bankUsers') || '{}');
      allUsers[currentUser] = {
        ...allUsers[currentUser],
        customerNumber: freshUserProfile.customerNumber,
        name: freshUserProfile.name,
        email: freshUserProfile.email,
        phone: freshUserProfile.phone || "",
        dateOfBirth: freshUserProfile.dateOfBirth || "",
        address: freshUserProfile.address || "",
        joinDate: freshUserProfile.joinDate || "",
        currency: freshUserProfile.currency || "EUR"
      };
      localStorage.setItem('bankUsers', JSON.stringify(allUsers));
      
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Unable to verify account status.",
        variant: "destructive",
      });
      return;
    }

    // Set animation state immediately to prevent double clicks
    setIsLoginAnimating(true);
    setLoginProgress(0);

    try {
      // Verify user exists locally first
      if (!UserDataManager.userExists(currentUser)) {
        throw new Error('User not found in local storage');
      }

      // Record login time and authenticate through auth context first
      UserDataManager.recordLoginTime(currentUser);

      // Use fresh profile data from database instead of localStorage cache
      login({
        id: freshUserProfile.id,
        name: freshUserProfile.name,
        email: freshUserProfile.email,
        customerNumber: currentUser
      });

      // Save authenticated user's data to localStorage (secure - only this user)
      saveAuthenticatedUserData(currentUser, freshUserProfile);

      // Smooth single-pass animation: 0% -> 100% over 4 seconds
      const totalDuration = 4000; // 4 seconds total
      const updateInterval = 25; // Update every 25ms for smooth visible changes
      const totalSteps = totalDuration / updateInterval;
      const progressStep = 100 / totalSteps;
      
      let currentProgress = 0;
      
      // Use Promise to ensure animation completes
      await new Promise<void>((resolve) => {
        const smoothInterval = setInterval(() => {
          currentProgress += progressStep;
          
          if (currentProgress >= 100) {
            currentProgress = 100;
            setLoginProgress(100);
            clearInterval(smoothInterval);
            resolve();
          } else {
            // Ensure progress only goes up, never down
            setLoginProgress((prev) => Math.max(prev, currentProgress));
            
            // Update stage based on progress
            if (currentProgress < 25) {
              setLoginStage('Checking connection...');
            } else if (currentProgress < 75) {
              setLoginStage('Authenticating...');
            } else if (currentProgress < 95) {
              setLoginStage('Loading account data...');
            } else {
              setLoginStage('Welcome to Bank of Ireland');
            }
          }
        }, updateInterval);
      });

      // Wait a moment at 100% before navigating
      await new Promise(resolve => setTimeout(resolve, 300));

      // Clear cold start flag - user has successfully logged in
      localStorage.removeItem('cold_start_active');
      
      // Authentication successful
      navigate("/dashboard");
    } catch (error) {
      // Reset animation state immediately
      setIsLoginAnimating(false);
      setLoginProgress(0);
      setLoginStage('');
      
      // Reset biometric verification state on error
      setBiometricVerified(false);
      setPinVerified(false);
      
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handlePinVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerNumber || !pin) {
      toast({
        title: "Missing Information",
        description: "Please enter both customer number and PIN",
        variant: "destructive",
      });
      return;
    }

    try {
      // Verify PIN with database
      const response = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerNumber,
          pin
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // PIN is correct, authenticate user
        UserDataManager.setCurrentUser(customerNumber);
        UserDataManager.initializeFreshAccount(customerNumber);
        UserDataManager.recordLoginTime(customerNumber);
        
        // Use API response data (source of truth) for new accounts
        const apiUserData = result.user;
        let userProfile = UserDataManager.getUserProfile();
        
        // If user profile doesn't exist locally, create it from API data
        if (!userProfile && apiUserData) {
          const newUserProfile = {
            customerNumber: apiUserData.customerNumber || customerNumber,
            name: apiUserData.name || '',
            email: apiUserData.email || '',
            phone: '',
            pin: '',
            joinDate: new Date().toISOString(),
            dateCreated: new Date().toISOString()
          };
          UserDataManager.registerUser(newUserProfile);
          userProfile = newUserProfile;
        }
        
        // Login with API data or local profile
        const userData = apiUserData || userProfile;
        if (userData) {
          login({
            id: apiUserData?.id || parseInt(customerNumber.replace(/\D/g, '')) || 1,
            name: userData.name || '',
            email: userData.email || '',
            customerNumber: customerNumber
          });
          
          // Save authenticated user's data to localStorage (secure - only this user)
          if (userProfile) {
            saveAuthenticatedUserData(customerNumber, userProfile);
          }
        }
        
        setPinVerified(true);
        toast({
          title: "Login Successful",
          description: "Welcome back to Bank of Ireland",
        });
        
        // Navigate to dashboard after verification
        navigate('/dashboard');
      } else {
        // PIN verification failed
        toast({
          title: "Login Failed",
          description: result.message || "Invalid customer number or PIN. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      toast({
        title: "Login Failed",
        description: "Unable to verify credentials. Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  const requestLocation = () => {
    setIsLoadingLocation(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      setIsLoadingLocation(false);
      return;
    }

    // Check if we've already asked for location (only ask once ever)
    const locationAsked = localStorage.getItem('location_permission_asked');
    
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsLoadingLocation(false);
        fetchNearbyATMs(latitude, longitude);
        
        // Mark that we've asked for location (first time only)
        if (!locationAsked) {
          localStorage.setItem('location_permission_asked', 'true');
          console.log('Location permission requested (first time only - for ATM locator)');
        }
      },
      (error) => {
        let errorMessage = "Location access needed to display nearby ATMs.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location permissions to find nearby ATMs.";
            // Mark as asked even if denied (never ask again)
            if (!locationAsked) {
              localStorage.setItem('location_permission_asked', 'true');
              console.log('Location permission denied (will not ask again)');
            }
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
        }
        setLocationError(errorMessage);
        setIsLoadingLocation(false);
      },
      options
    );
  };

  const fetchNearbyATMs = async (lat: number, lng: number) => {
    try {
      // Using OpenStreetMap Overpass API to find ATMs within 10 miles (16km)
      const radius = 16000; // 10 miles in meters
      const overpassQuery = `
        [out:json][timeout:30];
        (
          node["amenity"="atm"](around:${radius},${lat},${lng});
          way["amenity"="atm"](around:${radius},${lat},${lng});
          relation["amenity"="atm"](around:${radius},${lat},${lng});
          node["amenity"="bank"](around:${radius},${lat},${lng});
          way["amenity"="bank"](around:${radius},${lat},${lng});
          relation["amenity"="bank"](around:${radius},${lat},${lng});
          node["amenity"="credit_union"](around:${radius},${lat},${lng});
          way["amenity"="credit_union"](around:${radius},${lat},${lng});
          node["shop"="money_lender"](around:${radius},${lat},${lng});
          node["office"="financial"](around:${radius},${lat},${lng});
          node["name"~"ATM|Bank|Credit|Banque|Banco|Banca|Sparkasse|Volksbank|Commerzbank|Deutsche Bank|HSBC|Barclays|Lloyds|Santander|BNP|Crédit|ING|Rabobank|ABN|PostBank|Geldautomat|Cajero|Bancomat|Distributeur"](around:${radius},${lat},${lng});
        );
        out geom;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: overpassQuery,
        headers: {
          'Content-Type': 'text/plain',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ATM data');
      }

      const data = await response.json();
      
      // Process and format ATM data with better fallbacks
      const atms = data.elements.map((element: any) => {
        const elementLat = element.lat || (element.center && element.center.lat);
        const elementLng = element.lon || (element.center && element.center.lon);
        
        if (!elementLat || !elementLng) return null;
        
        const distance = calculateDistance(lat, lng, elementLat, elementLng);
        
        // Determine location type and name
        let name = 'ATM';
        let type = 'ATM';
        let network = 'Unknown';
        
        if (element.tags) {
          name = element.tags.name || element.tags.operator || element.tags.brand || 'ATM';
          network = element.tags.network || element.tags.brand || element.tags.operator || 'ATM';
          
          if (element.tags.amenity === 'bank') {
            type = 'Bank';
            if (!element.tags.name && !element.tags.operator && !element.tags.brand) {
              name = 'Bank';
            }
          } else if (element.tags.amenity === 'credit_union') {
            type = 'Credit Union';
            name = element.tags.name || 'Credit Union';
          } else if (element.tags.office === 'financial') {
            type = 'Financial Services';
            name = element.tags.name || 'Financial Services';
          }
        }
        
        // Build address with multiple fallbacks
        let address = 'Address not available';
        if (element.tags) {
          if (element.tags.addr_full) {
            address = element.tags.addr_full;
          } else {
            const parts = [];
            if (element.tags['addr:housenumber']) parts.push(element.tags['addr:housenumber']);
            if (element.tags['addr:street']) parts.push(element.tags['addr:street']);
            if (element.tags['addr:city']) parts.push(element.tags['addr:city']);
            if (element.tags['addr:state']) parts.push(element.tags['addr:state']);
            if (element.tags['addr:postcode']) parts.push(element.tags['addr:postcode']);
            
            if (parts.length > 0) {
              address = parts.join(', ');
            }
          }
        }
        
        return {
          id: element.id,
          lat: elementLat,
          lng: elementLng,
          name,
          network,
          address,
          type,
          distance
        };
      }).filter((atm: any) => atm && atm.distance <= 16) // Filter within 16km
        .sort((a: any, b: any) => a.distance - b.distance)
        .slice(0, 20); // Show top 20 closest locations

      setNearbyATMs(atms);

      // If still no results, try a backup search with different approach
      if (atms.length === 0) {
        await fetchBackupATMs(lat, lng);
      }
    } catch (error) {
      console.error('Error fetching ATMs:', error);
      // Try backup search on error
      await fetchBackupATMs(lat, lng);
    }
  };

  const fetchBackupATMs = async (lat: number, lng: number) => {
    try {
      // Backup search with broader global criteria
      const radius = 25000; // ~15.5 miles for wider coverage
      const backupQuery = `
        [out:json][timeout:35];
        (
          node["amenity"~"^(atm|bank|bureau_de_change)$"](around:${radius},${lat},${lng});
          way["amenity"~"^(atm|bank|bureau_de_change)$"](around:${radius},${lat},${lng});
          node["office"~"^(financial|bank)$"](around:${radius},${lat},${lng});
          node["shop"~"^(money_lender|pawnbroker)$"](around:${radius},${lat},${lng});
          node["brand"~"Visa|Mastercard|Cirrus|Plus|Maestro|Interac|Eftpos|UnionPay|JCB|Discover"](around:${radius},${lat},${lng});
          node["operator"~"Bank|ATM|Geldautomat|Cajero|Bancomat|Distributeur|Cash|Money"](around:${radius},${lat},${lng});
          node["name"~"(?i)(atm|bank|credit|banque|banco|banca|sparkasse|geldautomat|cajero|bancomat|distributeur|cash|money|financial|finance)"](around:${radius},${lat},${lng});
        );
        out geom;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: backupQuery,
        headers: {
          'Content-Type': 'text/plain',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const backupAtms = data.elements.map((element: any) => ({
          id: element.id,
          lat: element.lat || (element.center && element.center.lat),
          lng: element.lon || (element.center && element.center.lon),
          name: element.tags?.name || element.tags?.operator || element.tags?.brand || 'Banking Location',
          network: element.tags?.network || element.tags?.brand || 'Banking',
          address: element.tags?.addr_full || 
                   `${element.tags?.['addr:city'] || ''} ${element.tags?.['addr:postcode'] || ''}`.trim() ||
                   'Address not available',
          type: element.tags?.amenity === 'bank' ? 'Bank' : 'ATM',
          distance: calculateDistance(lat, lng, 
                     element.lat || (element.center && element.center.lat),
                     element.lon || (element.center && element.center.lon))
        })).filter((atm: any) => atm.lat && atm.lng && atm.distance <= 20)
          .sort((a: any, b: any) => a.distance - b.distance)
          .slice(0, 10);

        if (backupAtms.length > 0) {
          setNearbyATMs(backupAtms);
        } else {
          // If still no results, show informative message
          setNearbyATMs([]);
        }
      }
    } catch (backupError) {
      console.error('Backup search failed:', backupError);
      toast({
        title: "Search Complete",
        description: "No ATMs or bank branches found within 10 miles of your location.",
        variant: "destructive",
      });
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };

  const formatDistance = (km: number) => {
    // Use miles for US/UK, kilometers for most other countries
    const userLocale = navigator.language || 'en-US';
    const isImperial = userLocale.includes('US') || userLocale.includes('GB');
    
    if (isImperial) {
      const miles = km * 0.621371;
      return `${miles.toFixed(1)} mi`;
    } else {
      return `${km.toFixed(1)} km`;
    }
  };

  const handleATMLocatorOpen = () => {
    setShowATMLocator(true);
    if (!userLocation) {
      requestLocation();
    }
  };

  return (
    <div className="full-height relative ios-safe-top ios-safe-bottom ios-safe-left ios-safe-right page-fade-in">
      {/* Loading overlay */}
      {(isNavigating || isLoginAnimating) && (
        <div className="fixed inset-0 bg-gradient-to-br from-[#126987] to-[#2d5a6b] z-50 flex flex-col items-center justify-center">
          {/* Background overlay pattern */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url('/background.jpg')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          
          <div className="relative z-10">
            {/* Bank of Ireland Logo with authentic styling - always visible */}
            <div className="mb-8 flex flex-col items-center">
              <img 
                src={userCurrency === 'GBP' ? ukLogoPath : "/boi_logo.svg"} 
                alt={userCurrency === 'GBP' ? "Bank of Ireland UK" : "Bank of Ireland"} 
                className={`${userCurrency === 'GBP' ? 'h-11' : 'h-10'} filter brightness-0 invert mb-2 asset-instant`}
                loading="eager"
                decoding="sync"
                style={{ 
                  display: 'block',
                  opacity: 1,
                  visibility: 'visible',
                  imageRendering: 'crisp-edges'
                }}
              />
              <div className="w-16 h-1 bg-white opacity-30 rounded-full"></div>
            </div>
          
          {/* Login Animation */}
          {isLoginAnimating ? (
            <div className="text-center space-y-6">
              {/* Animated Security Icon */}
              <div className="relative">
                <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <img 
                    src="/icon_HID.svg" 
                    alt="Security" 
                    className="w-10 h-10 filter brightness-0 invert animate-pulse asset-instant"
                    loading="eager"
                    decoding="sync"
                    style={{ 
                      imageRendering: 'crisp-edges',
                      opacity: 1,
                      visibility: 'visible'
                    }}
                  />
                </div>
                
                {/* Pulsing rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 border border-white border-opacity-30 rounded-full animate-ping"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-28 h-28 border border-white border-opacity-20 rounded-full animate-pulse"></div>
                </div>
                
                {/* Rotating outer ring */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 border-2 border-white border-opacity-10 border-t-white border-t-opacity-40 rounded-full animate-spin"></div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-64 mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span 
                    className="text-white text-sm font-medium transition-opacity duration-300" 
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                    key={loginStage}
                  >
                    {loginStage}
                  </span>
                  <span className="text-white text-sm opacity-75" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    {Math.round(loginProgress)}%
                  </span>
                </div>
                <div className="w-full bg-white bg-opacity-20 rounded-full h-1">
                  <div 
                    className="bg-white h-1 rounded-full"
                    style={{ 
                      width: `${loginProgress}%`,
                      transition: 'none'
                    }}
                  ></div>
                </div>
              </div>
              
              {/* Security Message with BOI styling */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <img src="/cert.svg" alt="Certified" className="w-4 h-4 filter brightness-0 invert opacity-75" />
                  <p className="text-white text-xs opacity-75" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Bank-grade security
                  </p>
                </div>
                <p className="text-white text-xs opacity-60 max-w-xs mx-auto leading-relaxed" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Your connection is secured with 256-bit encryption
                </p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          )}
          </div>
        </div>
      )}
      
      {/* Background with scenic image */}
      <div 
        className="fixed inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('/background.jpg')`
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-center pt-12 pb-6 flex-shrink-0">
          <div className="flex items-center">
            <button 
              onClick={handleLogoTap}
              className="active:scale-95 transition-transform"
            >
              <img 
                src={userCurrency === 'GBP' ? ukLogoPath : "/boi_logo.svg"} 
                alt={userCurrency === 'GBP' ? "Bank of Ireland UK" : "Bank of Ireland"} 
                className={`${userCurrency === 'GBP' ? 'h-9' : 'h-8'} filter brightness-0 invert`}
              />
            </button>
          </div>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden ios-scroll">
          <div className="px-5 pt-8 pb-32">
            <div className="w-full max-w-xs mx-auto space-y-3">
              {/* Main White Login Card */}
              <div className="bg-white ios-card p-4">


                {/* Offline Status Notice */}
                {connectionStatus === 'offline' && offlineStatus && (
                  <div className={`p-3 rounded-lg border mb-4 ${offlineStatus.hasOfflineAccess ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-xs font-medium" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      {offlineStatus.hasOfflineAccess 
                        ? `Offline mode active (${offlineStatus.timeRemaining} remaining)`
                        : 'Offline login expired. Please reconnect to the internet to log in again.'
                      }
                    </p>
                  </div>
                )}
                
                {/* Biometric Section */}
                <div className="text-center mb-6">
                  <div 
                    className={`w-16 h-16 mx-auto mb-4 relative flex items-center justify-center rounded-full transition-all duration-300 cursor-pointer group ${
                      biometricVerified 
                        ? 'bg-gradient-to-br from-green-50 to-emerald-100'
                        : isScanning 
                          ? 'bg-gradient-to-br from-blue-50 to-blue-100' 
                          : 'bg-gradient-to-br from-gray-50 to-gray-100 hover:from-blue-50 hover:to-blue-100'
                    }`}
                    {...(faceIdEnabled 
                      ? { onClick: handleBiometricHoldStart } 
                      : {
                          onMouseDown: handleBiometricHoldStart,
                          onMouseUp: handleBiometricHoldEnd,
                          onMouseLeave: handleBiometricHoldEnd,
                          onTouchStart: handleBiometricHoldStart,
                          onTouchEnd: handleBiometricHoldEnd
                        }
                    )}
                    style={{
                      touchAction: 'manipulation',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    {/* Progress ring for holding - only show for fingerprint */}
                    {isScanning && !faceIdEnabled && (
                      <div className="absolute inset-0 rounded-full">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            className="text-gray-200"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeLinecap="round"
                            className="text-blue-500 transition-all duration-100"
                            strokeDasharray={`${2 * Math.PI * 45}`}
                            strokeDashoffset={`${2 * Math.PI * 45 * (1 - holdProgress / 100)}`}
                          />
                        </svg>
                      </div>
                    )}
                    
                    {/* Simplified visual feedback */}
                    {isScanning && (
                      <div className="absolute inset-0 rounded-full border-2 border-blue-300 opacity-50"></div>
                    )}
                    
                    {/* Biometric icon - Face ID or Fingerprint based on settings */}
                    <div className="relative z-10 w-10 h-10 flex items-center justify-center">
                      <img 
                        src={faceIdEnabled ? faceIdIconPath : "/Icons_Fingerprint.svg"} 
                        alt={faceIdEnabled ? "Face ID" : "Fingerprint"} 
                        className={faceIdEnabled ? "w-9 h-9" : "w-8 h-8"}
                        loading="eager"
                        style={{
                          filter: biometricVerified 
                            ? 'brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(86deg) brightness(118%) contrast(119%)'
                            : isScanning
                              ? 'brightness(0) saturate(100%) invert(47%) sepia(96%) saturate(1234%) hue-rotate(204deg) brightness(97%) contrast(97%)'
                              : 'brightness(0) saturate(100%) invert(29%) sepia(16%) saturate(456%) hue-rotate(174deg) brightness(96%) contrast(88%)',
                          imageRendering: 'crisp-edges'
                        }}
                      />
                    </div>
                  </div>
                  <p 
                    className="text-gray-700 text-sm" 
                    style={{ 
                      fontFamily: 'OpenSans, sans-serif',
                      touchAction: 'manipulation',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    {biometricVerified 
                      ? (faceIdEnabled ? 'Face ID verified' : 'Fingerprint verified')
                      : isScanning 
                        ? (faceIdEnabled ? 'Verifying Face ID...' : 'Hold to scan fingerprint...')
                        : (faceIdEnabled ? 'Face ID login' : 'Biometrics login')
                    }
                  </p>
                </div>

                {/* Log in Button */}
                <button 
                  onClick={handleLoginButton}
                  disabled={isLoading}
                  className={`w-full py-2.5 ios-button font-semibold text-sm mb-3 transition-all duration-200 android-no-highlight ${
                    biometricVerified || pinVerified 
                      ? 'bg-[#126987] text-white hover:bg-[#3a5a65] active:scale-95' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  } disabled:opacity-50`}
                  style={{ 
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    WebkitTapHighlightColor: 'transparent',
                    outline: 'none'
                  }}
                >
                  {isLoading ? "Logging in..." : "Log in"}
                </button>

                {/* Forgot PIN */}
                <div className="text-center mb-3">
                  <button className="text-[#126987] text-xs flex items-center justify-center space-x-1 active:scale-95 transition-transform android-no-highlight" style={{ 
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    WebkitTapHighlightColor: 'transparent',
                    outline: 'none'
                  }}>
                    <span>Forgot your PIN?</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-3"></div>

                {/* Alternative Login */}
                <div className="text-center">
                  <button className="flex items-center justify-center space-x-2 text-[#126987] text-xs mx-auto active:scale-95 transition-transform" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                    <User className="w-3 h-3" />
                    <span>Log in with another ID</span>
                  </button>
                </div>
              </div>

              {/* PIN Option Card - separate gray card */}
              <button 
                className="w-full bg-gray-50 border border-gray-200 ios-card p-3 flex items-center space-x-3 hover:bg-gray-100 active:scale-98 transition-all duration-150"
                onClick={() => {
                  console.log("PIN button clicked, current showPinLogin:", showPinLogin);
                  setShowPinLogin(!showPinLogin);
                }}
              >
                <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 text-xs font-bold">⋯</span>
                </div>
                <span className="flex-1 text-left text-gray-700 text-xs font-medium" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>Use your PIN instead</span>
                <span className="text-gray-400 text-sm">›</span>
              </button>

              {/* PIN Login Form - shows when showPinLogin is true */}
              {showPinLogin ? (
                <div className="bg-white ios-card p-4 border-2 border-blue-200">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                    Log in with PIN
                  </h3>
                  <form onSubmit={handlePinVerification} className="space-y-4">
                    <div>
                      <Label htmlFor="customerNumber" className="text-sm font-medium text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        Customer Number
                      </Label>
                      <Input
                        id="customerNumber"
                        type="text"
                        value={customerNumber}
                        onChange={(e) => setCustomerNumber(e.target.value)}
                        placeholder="Enter your customer number"
                        className="mt-1 ios-input"
                        disabled={isLoading}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="pin" className="text-sm font-medium text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        PIN
                      </Label>
                      <Input
                        id="pin"
                        type="password"
                        value={pin}
                        onChange={(e) => {
                          setPin(e.target.value);
                          // Auto-verify when PIN is 4 digits and customer number is present
                          if (e.target.value.length === 4 && customerNumber.length > 0) {
                            setTimeout(() => {
                              handlePinVerification({ preventDefault: () => {} } as React.FormEvent);
                            }, 500);
                          }
                        }}
                        placeholder="Enter your 4-digit PIN"
                        className="mt-1 ios-input"
                        maxLength={4}
                        disabled={isLoading}
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className={`w-full text-white hover:bg-[#3a5a65] ${
                        pinVerified ? 'bg-green-600' : 'bg-[#126987]'
                      }`}
                      disabled={isLoading || pinVerified}
                      style={{ fontFamily: 'OpenSans, sans-serif' }}
                    >
                      {pinVerified ? "PIN Verified ✓" : "Verify PIN"}
                    </Button>
                    
                    <button
                      type="button"
                      onClick={() => setShowPinLogin(false)}
                      className="w-full text-gray-500 text-sm hover:text-gray-700 transition-colors duration-150"
                      style={{ fontFamily: 'OpenSans, sans-serif' }}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              ) : null}

              {/* Approval Option Card - display only */}
              <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center space-x-3">
                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                  <img src="/lock.svg" alt="Lock" className="w-3 h-3" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-gray-700 text-sm font-medium" style={{ fontFamily: 'OpenSans, sans-serif' }}>Waiting for your approval</div>
                  <div className="text-gray-500 text-xs mt-0.5" style={{ fontFamily: 'OpenSans, sans-serif' }}>Tap here to complete unfinished business</div>
                </div>
                <span className="text-gray-400 text-lg">›</span>
              </div>


            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#126987]/95 backdrop-blur-sm px-4 py-3 ios-safe-bottom">
          <div className="flex justify-evenly items-center w-full max-w-xs mx-auto">
            <button 
              className="flex flex-col items-center space-y-1 py-2 transition-opacity duration-150 hover:opacity-80"
              onClick={handleATMLocatorOpen}
              disabled={isNavigating || isLoading}
            >
              <MapPin className="w-5 h-5 text-white" />
              <span className="text-white text-xs font-medium" style={{ fontFamily: 'OpenSans, sans-serif' }}>ATM/Branch</span>
            </button>
            <button className="flex flex-col items-center space-y-1 py-2 transition-opacity duration-150 hover:opacity-80">
              <Shield className="w-5 h-5 text-white" />
              <span className="text-white text-xs font-medium" style={{ fontFamily: 'OpenSans, sans-serif' }}>Security</span>
            </button>
            <button 
              className="flex flex-col items-center space-y-1 py-2 transition-opacity duration-150 hover:opacity-80"
              onClick={() => setShowMoreMenu(true)}
              disabled={isNavigating || isLoading}
            >
              <MoreHorizontal className="w-5 h-5 text-white" />
              <span className="text-white text-xs font-medium" style={{ fontFamily: 'OpenSans, sans-serif' }}>More</span>
            </button>
          </div>
        </div>
      </div>

      {/* More Menu Modal */}
      {showMoreMenu && (
        <div className="modal-overlay bg-black bg-opacity-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md mx-4 mb-0 p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                More Options
              </h3>
              <button 
                onClick={() => setShowMoreMenu(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <span className="text-gray-600 text-lg">×</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <button className="w-full flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800" style={{ fontFamily: 'OpenSans, sans-serif' }}>Help & Support</p>
                  <p className="text-sm text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>Get assistance with login</p>
                </div>
              </button>
              
              <button className="w-full flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Phone className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800" style={{ fontFamily: 'OpenSans, sans-serif' }}>Contact Us</p>
                  <p className="text-sm text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>Phone support & branches</p>
                </div>
              </button>
              
              <button className="w-full flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Settings className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800" style={{ fontFamily: 'OpenSans, sans-serif' }}>Accessibility</p>
                  <p className="text-sm text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>Login accessibility options</p>
                </div>
              </button>
              
              <button className="w-full flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800" style={{ fontFamily: 'OpenSans, sans-serif' }}>Security Info</p>
                  <p className="text-sm text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>Learn about secure banking</p>
                </div>
              </button>
            </div>
            
            <button 
              onClick={() => setShowMoreMenu(false)}
              className="w-full mt-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              style={{ fontFamily: 'OpenSans, sans-serif' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Sign Up Modal */}
      {showSignUp && (
        <div 
          className="fixed inset-0 bg-white flex flex-col z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSignUp(false);
            }
          }}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0"
            style={{ 
              backgroundColor: '#126987',
              paddingTop: 'env(safe-area-inset-top, 12px)'
            }}
          >
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'OpenSans, sans-serif' }}>
              {signUpStep === 'initial' ? 'Create Account' : 'Account Details'}
            </h2>
            <button 
              onClick={() => setShowSignUp(false)}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            >
              <span className="text-white text-lg">×</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto ios-scroll flex flex-col">
            <div className="w-full max-w-md mx-auto px-6 py-8 flex flex-col justify-center flex-1">
              {/* Initial Step - Create Account Button */}
              {signUpStep === 'initial' && (
                <div>
                  <div className="text-center space-y-6 py-12">
                    <h3 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Get Started
                    </h3>
                    <p className="text-lg text-gray-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Create a new account to access your banking services
                    </p>
                  </div>

                  <button
                    onClick={() => setSignUpStep('form')}
                    className="w-full p-4 bg-green-50 text-green-600 rounded-xl font-semibold active:scale-98 transition-transform border border-green-200 text-lg"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  >
                    Create New Account
                  </button>
                </div>
              )}

              {/* Form Step */}
              {signUpStep === 'form' && (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSignUp();
                  }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Full Name
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={newUserData.name}
                      onChange={(e) => setNewUserData({...newUserData, name: e.target.value})}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
                      style={{ fontFamily: 'OpenSans, sans-serif' }}
                      placeholder="Enter your full name"
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Email Address
                    </label>
                    <input
                      ref={emailInputRef}
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
                      style={{ fontFamily: 'OpenSans, sans-serif' }}
                      placeholder="Enter your email address"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Phone Number
                    </label>
                    <input
                      ref={phoneInputRef}
                      type="tel"
                      value={newUserData.phone}
                      onChange={(e) => setNewUserData({...newUserData, phone: e.target.value})}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
                      style={{ fontFamily: 'OpenSans, sans-serif' }}
                      placeholder="+353 XX XXX XXXX"
                      autoComplete="tel"
                      required
                    />
                  </div>

                  <div className="flex space-x-3 pt-6">
                    <button
                      type="button"
                      onClick={() => setSignUpStep('initial')}
                      className="flex-1 p-4 bg-gray-100 text-gray-700 rounded-xl font-semibold active:scale-98 transition-transform text-base"
                      style={{ fontFamily: 'OpenSans, sans-serif' }}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 p-4 bg-green-600 text-white rounded-xl font-semibold active:scale-98 transition-transform text-base"
                      style={{ fontFamily: 'OpenSans, sans-serif' }}
                    >
                      Continue
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}


      {/* OTC Verification Modal */}
      {showOtcVerification && (
        <div className="fixed inset-0 bg-white flex flex-col z-50">
          {/* Header */}
          <div 
            className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0"
            style={{ 
              backgroundColor: '#126987',
              paddingTop: 'env(safe-area-inset-top, 12px)'
            }}
          >
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'OpenSans, sans-serif' }}>
              Verification Code
            </h2>
            <button 
              onClick={() => {
                setShowOtcVerification(false);
                setOtcCode('');
                setPendingAccountData(null);
              }}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            >
              <span className="text-white text-lg">×</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto ios-scroll flex flex-col">
            <div className="w-full max-w-md mx-auto px-6 py-8 flex flex-col justify-center flex-1 space-y-8">
              <div className="text-center space-y-2">
                <p className="text-base text-gray-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Enter the 6-digit verification code
                </p>
                <p className="text-sm text-gray-500" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  sent to the administrator
                </p>
              </div>

              <div>
                <input
                  type="text"
                  value={otcCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtcCode(value);
                  }}
                  className="w-full p-6 border-2 border-gray-300 rounded-xl text-center text-4xl font-mono tracking-[0.5rem] font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              {pendingAccountData && (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold mb-3" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Creating Account For
                  </p>
                  <p className="text-base text-gray-900 font-semibold" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    {pendingAccountData.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    {pendingAccountData.email}
                  </p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtcVerification(false);
                    setOtcCode('');
                    setPendingAccountData(null);
                  }}
                  className="flex-1 p-4 bg-gray-100 text-gray-700 rounded-xl font-semibold active:scale-98 transition-transform text-base"
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleOtcVerification}
                  disabled={otcCode.length !== 6}
                  className={`flex-1 p-4 rounded-xl font-semibold active:scale-98 transition-transform text-base ${
                    otcCode.length === 6 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  style={{ fontFamily: 'OpenSans, sans-serif' }}
                >
                  Verify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ATM Locator Modal */}
      {showATMLocator && (
        <div className="modal-overlay bg-black bg-opacity-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md mx-4 mb-0 h-[85vh] flex flex-col animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                ATM Locator
              </h3>
              <button 
                onClick={() => setShowATMLocator(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <span className="text-gray-600 text-lg">×</span>
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingLocation ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="w-8 h-8 border-4 border-[#126987] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600 text-center" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Getting your location...
                  </p>
                </div>
              ) : locationError ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <MapPin className="w-8 h-8 text-red-600" />
                  </div>
                  <p className="text-gray-800 font-medium mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Location Access Required
                  </p>
                  <p className="text-gray-600 text-sm mb-4" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    {locationError}
                  </p>
                  <button
                    onClick={requestLocation}
                    className="px-6 py-2 bg-[#126987] text-white rounded-lg font-medium hover:bg-[#3a5a65] transition-colors"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  >
                    Try Again
                  </button>
                </div>
              ) : userLocation && nearbyATMs.length > 0 ? (
                <div className="space-y-4">
                  {/* Simple Map Placeholder */}
                  <div className="h-48 bg-gray-100 rounded-xl border-2 border-gray-200 flex items-center justify-center mb-6">
                    <div className="text-center">
                      <MapPin className="w-8 h-8 text-[#126987] mx-auto mb-2" />
                      <p className="text-sm text-gray-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        Map showing {nearbyATMs.length} nearby ATMs
                      </p>
                      <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        Location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>

                  {/* ATM List */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-800 mb-3" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Nearby ATMs
                    </h4>
                    {nearbyATMs.map((atm, index) => (
                      <div key={atm.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <div className="w-2 h-2 bg-[#126987] rounded-full"></div>
                              <h5 className="font-medium text-gray-800" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                                {atm.name}
                              </h5>
                            </div>
                            <p className="text-sm text-gray-600 mb-1" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                              {atm.address}
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>{formatDistance(atm.distance)} away</span>
                              {atm.type && atm.type !== 'ATM' && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                                  {atm.type}
                                </span>
                              )}
                              {atm.network !== 'Unknown' && atm.network !== 'ATM' && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                  {atm.network}
                                </span>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              const url = `https://www.google.com/maps/dir/?api=1&destination=${atm.lat},${atm.lng}`;
                              window.open(url, '_blank');
                            }}
                            className="px-3 py-1 bg-[#126987] text-white text-xs rounded-lg hover:bg-[#3a5a65] transition-colors"
                            style={{ fontFamily: 'OpenSans, sans-serif' }}
                          >
                            Directions
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : userLocation && nearbyATMs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <MapPin className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-800 font-medium mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    No ATMs Found
                  </p>
                  <p className="text-gray-600 text-sm" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    No ATMs found within 10 miles of your location. Try searching in a different area.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <MapPin className="w-8 h-8 text-[#126987]" />
                  </div>
                  <p className="text-gray-800 font-medium mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Find Nearby ATMs
                  </p>
                  <p className="text-gray-600 text-sm mb-4" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Allow location access to see ATMs and branches near you.
                  </p>
                  <button
                    onClick={requestLocation}
                    className="px-6 py-2 bg-[#126987] text-white rounded-lg font-medium hover:bg-[#3a5a65] transition-colors"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  >
                    Enable Location
                  </button>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-gray-200">
              <button 
                onClick={() => setShowATMLocator(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                style={{ fontFamily: 'OpenSans, sans-serif' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Lock Modal - Full Screen */}
      {showDeviceLockModal && (
        <div className="fixed inset-0 bg-white flex flex-col z-50">
          {/* Header */}
          <div 
            className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0"
            style={{ 
              backgroundColor: '#126987',
              paddingTop: 'env(safe-area-inset-top, 12px)'
            }}
          >
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'OpenSans, sans-serif' }}>
              Device Security
            </h2>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto ios-scroll flex flex-col">
            <div className="w-full max-w-md mx-auto px-6 py-8 flex flex-col justify-center flex-1 space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-[#126987]" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Account Locked to This Device
                </h3>
                <p className="text-base text-gray-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Your Bank of Ireland account is now secured to this device only. For security, you can only access your account from this phone.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 space-y-3 border border-gray-200">
                <div className="flex items-start space-x-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                  <p className="text-sm text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Account is secure on this device only
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                  <p className="text-sm text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                    Your data is encrypted and protected
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowDeviceLockModal(false);
                  setShowNotificationPermissionModal(true);
                }}
                className="w-full p-4 bg-green-600 text-white rounded-xl font-semibold active:scale-98 transition-transform text-base"
                style={{ fontFamily: 'OpenSans, sans-serif' }}
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Permission Modal - Full Screen */}
      {showNotificationPermissionModal && (
        <div className="fixed inset-0 bg-white flex flex-col z-50">
          {/* Header */}
          <div 
            className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0"
            style={{ 
              backgroundColor: '#126987',
              paddingTop: 'env(safe-area-inset-top, 12px)'
            }}
          >
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'OpenSans, sans-serif' }}>
              Enable Notifications
            </h2>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto ios-scroll flex flex-col">
            <div className="w-full max-w-md mx-auto px-6 py-8 flex flex-col justify-center flex-1 space-y-6">
              {!notificationDenied ? (
                <>
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Enable Notifications
                    </h3>
                    <p className="text-base text-gray-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Receive instant alerts for transactions, security updates, and important banking information.
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-xl p-5 space-y-3 border border-green-200">
                    <div className="flex items-start space-x-3">
                      <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                      <p className="text-sm text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        Real-time transaction notifications
                      </p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                      <p className="text-sm text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        Security alerts and suspicious activity warnings
                      </p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                      <p className="text-sm text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                        Important account updates
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      // Request notification permission
                      if ('Notification' in window && Notification.permission !== 'granted') {
                        try {
                          const permission = await Notification.requestPermission();
                          if (permission === 'granted') {
                            console.log('Notification permission granted');
                            setShowNotificationPermissionModal(false);
                            setPendingAccountData(null);
                            setNotificationDenied(false);
                            navigate("/dashboard");
                          } else {
                            // User denied, show the denial screen
                            setNotificationDenied(true);
                          }
                        } catch (error) {
                          console.log('Notification permission denied');
                          setNotificationDenied(true);
                        }
                      } else if (Notification.permission === 'granted') {
                        // Already granted
                        setShowNotificationPermissionModal(false);
                        setPendingAccountData(null);
                        setNotificationDenied(false);
                        navigate("/dashboard");
                      }
                    }}
                    className="w-full p-4 bg-green-600 text-white rounded-xl font-semibold active:scale-98 transition-transform text-base"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  >
                    Enable Notifications
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2M7.08 6.06A9 9 0 100.02 12m0 0a9 9 0 1014.14-9" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Notifications Required
                    </h3>
                    <p className="text-base text-gray-600" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Notifications are required for your account security. Please enable them to continue.
                    </p>
                  </div>

                  <div className="bg-yellow-50 rounded-xl p-5 border border-yellow-200">
                    <p className="text-sm text-gray-700" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                      Notifications help protect your account by alerting you to suspicious activity and important security updates.
                    </p>
                  </div>

                  <button
                    onClick={async () => {
                      // Request notification permission again
                      if ('Notification' in window && Notification.permission !== 'granted') {
                        try {
                          const permission = await Notification.requestPermission();
                          if (permission === 'granted') {
                            console.log('Notification permission granted');
                            setShowNotificationPermissionModal(false);
                            setPendingAccountData(null);
                            setNotificationDenied(false);
                            navigate("/dashboard");
                          }
                        } catch (error) {
                          console.log('Notification permission denied');
                        }
                      }
                    }}
                    className="w-full p-4 bg-green-600 text-white rounded-xl font-semibold active:scale-98 transition-transform text-base"
                    style={{ fontFamily: 'OpenSans, sans-serif' }}
                  >
                    Enable Notifications
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}