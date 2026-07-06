import { useState, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import BottomNavigation from "@/components/BottomNavigation";
import { SecurityWrapper } from "@/components/SecurityWrapper";
import ErrorBoundary from "@/components/ErrorBoundary";
import { StateManager } from "@/utils/stateManager";
import { AppLifecycle } from "@/utils/appLifecycle";
import { flushPendingBalanceSyncs, flushPendingTransactionSyncs } from "@/utils/transferUtils";
import { PlatformDetection } from "@/utils/platformDetection";
import { applyThemeColor } from "@/utils/themeColor";
import LiveChat from "@/components/LiveChat";



import Splash from "@/pages/splash";
import Login from "@/pages/login";
import More from "@/pages/more";
import Dashboard from "@/pages/dashboard";
import Payments from "@/pages/payments";
import Apply from "@/pages/apply";
import IbanTransfer from "@/pages/iban-transfer";
import UkTransfer from "@/pages/uk-transfer";
import InternalTransfer from "@/pages/internal-transfer";
import EmailTransfer from "@/pages/email-transfer";
import Transactions from "@/pages/transactions";
import Cards from "@/pages/cards";
import Insights from "@/pages/insights";
import Transfer from "@/pages/transfer";
import BillPay from "@/pages/bill-pay";
import TransactionHistoryWorking from "@/pages/transaction-history-working";

import BankStatements from "@/pages/bank-statements";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import Help from "@/pages/help";
import CreditScore from "@/pages/credit-score";
import MonthlyInsights from "@/pages/monthly-insights";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const authHook = useAuth();
  const user = authHook?.user || null;
  const isLoading = authHook?.isLoading || false;
  const [initializationComplete, setInitializationComplete] = useState(false);
  
  // Check initialization status
  useEffect(() => {
    let initCheckInterval: NodeJS.Timeout;
    
    const checkInitialization = () => {
      const appSessionActive = localStorage.getItem('app_session_active');
      const splashCompleted = localStorage.getItem('splash_completed');
      
      // Mark as initialized if both conditions are met OR if we have a user
      if ((appSessionActive && splashCompleted) || user) {
        setInitializationComplete(true);
        if (initCheckInterval) {
          clearInterval(initCheckInterval);
        }
      }
    };
    
    // Check initialization immediately and then periodically
    checkInitialization();
    initCheckInterval = setInterval(checkInitialization, 100);
    
    return () => {
      if (initCheckInterval) clearInterval(initCheckInterval);
    };
  }, [user]);
  
  // Show loading screen during initialization
  if (!initializationComplete) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#126987]">
        <div className="text-white">Loading...</div>
      </div>
    );
  }
  
  // Normal protection logic after initialization - wait for auth to finish loading
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#126987]">
        <div className="text-white">Loading...</div>
      </div>
    );
  }
  
  // Only redirect to login if auth finished loading and there's no user
  if (!user) {
    return fallback ? <>{fallback}</> : <Redirect to="/login" />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const authHook = useAuth();
  const user = authHook?.user || null;

  const locationHook = useLocation();
  const [location, navigate] = locationHook || ['/', () => {}];
  const [splashShown, setSplashShown] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [splashTransitioning, setSplashTransitioning] = useState(false);
  const [isRestoringState, setIsRestoringState] = useState(true);
  
  // Global Live Chat state - persistent across all navigation
  const [showLiveChat, setShowLiveChat] = useState(false);

  // Listen for global live chat open events
  useEffect(() => {
    const handleOpenLiveChat = () => {
      setShowLiveChat(true);
    };

    window.addEventListener('openLiveChat', handleOpenLiveChat);
    return () => window.removeEventListener('openLiveChat', handleOpenLiveChat);
  }, []);

  // Initialize app state with proper cold/warm start detection
  useEffect(() => {
    let initializationTimer: NodeJS.Timeout;
    
    const initializeApp = async () => {
      try {
        // Initialize platform-specific handlers first
        PlatformDetection.setupPlatformSpecificHandlers();
        
        // Apply Android UI fixes to match iOS
        const { AndroidUIFixes } = await import('./utils/androidUIFixes');
        const { AndroidPerformanceOptimizer } = await import('./utils/androidPerformanceOptimizer');
        
        AndroidUIFixes.initialize();
        AndroidUIFixes.fixAccountCardStyling();
        AndroidUIFixes.removeAndroidRippleEffect();
        AndroidPerformanceOptimizer.initialize();
        
        // Initialize cache persistence system
        const { UserDataManager } = await import('./utils/userDataManager');
        UserDataManager.initializeCachePersistence();
        
        // Store access code from URL for revocation checking
        const urlParams = new URLSearchParams(window.location.search);
        const accessCode = urlParams.get('access');
        if (accessCode) {
          localStorage.setItem('currentAccessCode', accessCode);
        }
        
        // Start PWA-specific revocation checking
        const { startPWARevocationChecker, isPWA } = await import('./utils/pwaRevocationChecker');
        console.log('Checking PWA status...');
        const isPWAApp = isPWA();
        console.log('PWA detected:', isPWAApp);
        
        // Always start revocation checker for enhanced protection
        console.log('Starting enhanced revocation checker for all devices');
        startPWARevocationChecker();
        
        // Every real app start (the JS runtime actually (re)initializing,
        // whether the OS calls that "cold" or "warm") always goes through
        // splash then the login screen - the user authenticates explicitly
        // (Face ID hold or PIN) from there, even though their session is
        // still valid underneath. Previously "warm start" silently restored
        // the user and jumped straight to whatever route they'd left,
        // racing against this same screen's own user-based redirect and
        // producing a visible splash -> dashboard -> login bounce. Login
        // itself remains untouched by backgrounding the app briefly, since
        // that case never remounts this component at all (handled by the
        // visibilitychange listener below instead).
        console.log('App (re)initializing - showing splash sequence');

        setSplashShown(false);
        localStorage.removeItem('splash_completed');
        localStorage.removeItem('app_background_time');
        localStorage.setItem('app_session_active', 'true');
        localStorage.setItem('cold_start_active', 'true');
        
        // Preserve all user data - only clear truly temporary items
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('temp_cache_') || key.startsWith('_debug_')) {
            localStorage.removeItem(key);
          }
        });
        
        setIsRestoringState(false);
        // Mark as initialized after a brief delay
        setTimeout(() => setIsInitialized(true), 100);
        
      } catch (error) {
        console.error('App initialization error:', error);
        // Force initialization complete to prevent infinite loading
        setIsRestoringState(false);
        setIsInitialized(true);
      }
    };

    initializeApp();
    
    // Fallback timeout to prevent infinite initialization (15 seconds to allow slow networks)
    initializationTimer = setTimeout(() => {
      console.warn('App initialization timeout reached, forcing completion');
      setIsRestoringState(false);
      setIsInitialized(true);
    }, 15000);
    
    return () => {
      if (initializationTimer) {
        clearTimeout(initializationTimer);
      }
    };
  }, []);

  // Consolidated lifecycle event handling to prevent conflicts
  useEffect(() => {
    let backgroundTimer: NodeJS.Timeout | null = null;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App going to background - mark for warm start and save state
        localStorage.setItem('app_background_time', Date.now().toString());
        if (user) {
          StateManager.handleVisibilityChange(location, user);
        }
      } else {
        // App coming to foreground - this indicates warm start
        if (backgroundTimer) {
          clearTimeout(backgroundTimer);
          backgroundTimer = null;
        }
        // Re-apply theme-color on resume: visibilitychange is the one event
        // iOS reliably fires when a standalone PWA comes back to the
        // foreground (unlike 'focus'), so this is what actually corrects a
        // status bar left in the wrong color while backgrounded.
        applyThemeColor();
      }
    };

    const handleBeforeUnload = () => {
      // App being terminated - mark for cold start on next launch
      PlatformDetection.markColdStart();
      if (user) {
        StateManager.handleVisibilityChange(location, user);
      }
    };

    const handlePageHide = () => {
      // Page being hidden - potential app termination
      backgroundTimer = setTimeout(() => {
        PlatformDetection.markColdStart();
      }, 1000); // Short delay to distinguish between backgrounding and termination
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (backgroundTimer) {
        clearTimeout(backgroundTimer);
        backgroundTimer = null;
      }
      
      // If page was restored from cache, this is definitely a warm start
      if (event.persisted) {
        localStorage.setItem('app_session_active', 'true');
        applyThemeColor();
      }
    };

    // Register single set of event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    
    return () => {
      if (backgroundTimer) {
        clearTimeout(backgroundTimer);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [user, location]);



  // Listen for splash completion and mark it properly
  useEffect(() => {
    const handleSplashComplete = () => {
      setSplashTransitioning(true);
      // Mark splash as completed in localStorage for proper state tracking
      localStorage.setItem('splash_completed', 'true');

      // Small delay to prevent flash, then complete transition
      setTimeout(() => {
        setSplashShown(true);
        setSplashTransitioning(false);
      }, 100);

      // Restore theme-color after splash
      applyThemeColor();
    };

    window.addEventListener('splashComplete', handleSplashComplete);
    return () => window.removeEventListener('splashComplete', handleSplashComplete);
  }, []);

  // Focus event handling for theme restoration
  useEffect(() => {
    const handleFocusRestore = () => {
      applyThemeColor();
      // Ensure layout is correctly calculated after focus
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('focus', handleFocusRestore);
    return () => window.removeEventListener('focus', handleFocusRestore);
  }, [location]);

  // Flush any pending balance/transaction syncs when connectivity is restored
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Connectivity restored - syncing pending balances and transactions...');
      flushPendingBalanceSyncs();
      flushPendingTransactionSyncs();
    };
    window.addEventListener('online', handleOnline);
    // Also try on mount in case we're back online after a reconnect
    if (navigator.onLine) {
      flushPendingBalanceSyncs();
      flushPendingTransactionSyncs();
    }
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Keep theme-color in sync with route
  useEffect(() => {
    applyThemeColor();
  }, [location]);

  // Prevent flash during initialization
  if (!isInitialized) {
    return (
      <div className="w-full h-full bg-[#000DFF]">
        {/* Empty blue screen during initialization */}
      </div>
    );
  }

  return (
    <SecurityWrapper>
      <ErrorBoundary>
        <div className="fixed inset-0 overflow-hidden">
          <Switch>
            <Route path="/splash" component={Splash} />
            <Route path="/login" component={Login} />
            <Route path="/more" component={More} />
            <Route path="/">
              {(() => {
                const appSessionActive = localStorage.getItem('app_session_active');
                const splashCompleted = localStorage.getItem('splash_completed');

                if (!appSessionActive || (!splashShown && !splashCompleted)) {
                  return <Splash />;
                }

                // Always land on the login screen after splash - the user
                // authenticates explicitly (Face ID hold or PIN) from there.
                // This never auto-redirects to /dashboard based on a
                // restored session, since that raced with this same check
                // and produced a visible dashboard -> login bounce.
                return <Login />;
              })()}
            </Route>
          <Route path="/dashboard">
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          </Route>
          <Route path="/payments">
            <ProtectedRoute>
              <Payments />
            </ProtectedRoute>
          </Route>
          <Route path="/apply">
            <ProtectedRoute>
              <Apply />
            </ProtectedRoute>
          </Route>
          <Route path="/iban-transfer">
            <ProtectedRoute>
              <IbanTransfer />
            </ProtectedRoute>
          </Route>
          <Route path="/uk-transfer">
            <ProtectedRoute>
              <UkTransfer />
            </ProtectedRoute>
          </Route>
          <Route path="/internal-transfer">
            <ProtectedRoute>
              <InternalTransfer />
            </ProtectedRoute>
          </Route>
          <Route path="/email-transfer">
            <ProtectedRoute>
              <EmailTransfer />
            </ProtectedRoute>
          </Route>
          <Route path="/transfer">
            <ProtectedRoute>
              <Transfer />
            </ProtectedRoute>
          </Route>
          <Route path="/bills">
            <ProtectedRoute>
              <BillPay />
            </ProtectedRoute>
          </Route>
          <Route path="/transactions">
            <ProtectedRoute>
              <Transactions />
            </ProtectedRoute>
          </Route>
          <Route path="/cards">
            <ProtectedRoute>
              <Cards />
            </ProtectedRoute>
          </Route>
          <Route path="/insights">
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          </Route>
          <Route path="/monthly-insights">
            <ProtectedRoute>
              <MonthlyInsights />
            </ProtectedRoute>
          </Route>

          <Route path="/transactions/:accountId">
            <ProtectedRoute>
              <TransactionHistoryWorking />
            </ProtectedRoute>
          </Route>

          <Route path="/bank-statements">
            <ProtectedRoute>
              <BankStatements />
            </ProtectedRoute>
          </Route>
          <Route path="/profile">
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          </Route>
          <Route path="/settings">
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          </Route>
          <Route path="/help">
            <ProtectedRoute>
              <Help />
            </ProtectedRoute>
          </Route>
          <Route path="/credit-score">
            <ProtectedRoute>
              <CreditScore />
            </ProtectedRoute>
          </Route>
          <Route component={NotFound} />
        </Switch>
        <BottomNavigation />

        {/* Global Persistent Live Chat - stays active across all navigation */}
        <LiveChat isOpen={showLiveChat} onClose={() => setShowLiveChat(false)} />

        </div>
      </ErrorBoundary>
    </SecurityWrapper>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AppRoutes />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
