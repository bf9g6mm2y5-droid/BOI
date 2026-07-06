import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, ChevronRight, ArrowUpRight, CreditCard, Building2, Zap, Check, Clock, MapPin, Globe, X, FileText, Search, Info, Home, ArrowRightLeft, Landmark, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UserDataManager } from "../utils/userDataManager.ts";
import { StateManager } from "../utils/stateManager";
import { getPendingBalanceSyncs, syncBalanceToServer, syncTransactionToServer, cancelPendingTransactionSync } from "../utils/transferUtils";
import { formatCurrency, getUserCurrency, getCurrencySymbol, type Currency } from "../utils/currencyUtils";

interface Account {
  id: number;
  displayName: string;
  accountNumber: string;
  balance: string;
  accountType: string;
}

export default function TransactionHistoryWorking() {
  const locationHook = useLocation();
  const [, setLocation] = locationHook || [null, () => {}];
  const routeHook = useRoute("/transactions/:accountId");
  const [match, params] = routeHook || [false, {}];
  const [transactions, setTransactions] = useState<any[]>([]);
  const [balance, setBalance] = useState<string>('0.00');
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userCurrency, setUserCurrency] = useState<Currency>('EUR');
  const [activeTab, setActiveTab] = useState('transactions');
  const [showTransferConfirmation, setShowTransferConfirmation] = useState(() => {
    const saved = localStorage.getItem('showTransferConfirmation');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showBankDetailsButton, setShowBankDetailsButton] = useState(() => {
    const saved = localStorage.getItem('showBankDetailsButton');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showPopupBlockedModal, setShowPopupBlockedModal] = useState(false);
  const [pendingPdfUrl, setPendingPdfUrl] = useState<string | null>(null);
  const [customBankDisplayByAccount, setCustomBankDisplayByAccount] = useState<Record<number, {bic: string, iban: string, sortCode: string, accountNumber: string}>>(() => {
    const saved = localStorage.getItem('customBankDisplayByAccount');
    return saved ? JSON.parse(saved) : {};
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [showPayBillsForm, setShowPayBillsForm] = useState(false);
  const [payBillsForm, setPayBillsForm] = useState({
    payee: '',
    amount: '',
    datetime: ''
  });
  
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementDateRange, setStatementDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [isGeneratingStatement, setIsGeneratingStatement] = useState(false);
  const [statementError, setStatementError] = useState<string>('');
  const [statementSuccessState, setStatementSuccessState] = useState(false);
  const [statementPdfBlob, setStatementPdfBlob] = useState<Blob | null>(null);
  const [statementFileName, setStatementFileName] = useState<string>('');
  
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dateRangeType, setDateRangeType] = useState<'all' | 'month' | 'daterange'>('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [transactionType, setTransactionType] = useState('all');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{dateRangeType: string, transactionType: string, month?: string, dateFrom?: string, dateTo?: string} | null>(null);
  const [showAccountDetailsModal, setShowAccountDetailsModal] = useState(false);
  
  const transactionTypes = [
    { value: 'all', label: 'All' },
    { value: 'direct_debit', label: 'Direct Debits/Credits' },
    { value: 'contactless', label: 'Contactless' },
    { value: 'atm', label: 'ATM' },
    { value: 'lodgement', label: 'Lodgements\\Credits' },
    { value: 'credit_transfer', label: 'Credit transfers' },
    { value: 'cheque', label: 'Cheques' },
    { value: 'other_debit', label: 'Other Debits' },
    { value: 'cash_withdrawal', label: 'Cash Withdrawals' }
  ];
  
  const accountId = params?.accountId ? parseInt(params.accountId) : 1;

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('showTransferConfirmation');
      setShowTransferConfirmation(saved !== null ? JSON.parse(saved) : true);
      
      const savedBankButton = localStorage.getItem('showBankDetailsButton');
      setShowBankDetailsButton(savedBankButton !== null ? JSON.parse(savedBankButton) : true);
      
      const savedBankDisplay = localStorage.getItem('customBankDisplayByAccount');
      setCustomBankDisplayByAccount(savedBankDisplay ? JSON.parse(savedBankDisplay) : {});
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const navigateWithAnimation = (path: string, _direction?: string) => {
    setLocation(path);
  };

  const handlePayBillsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(payBillsForm.amount);
    if (!amount || amount <= 0 || !payBillsForm.payee || !payBillsForm.datetime) {
      alert('Please fill in all fields with valid values');
      return;
    }
    
    const currentBalance = parseFloat(balance);
    if (amount > currentBalance) {
      alert('Insufficient funds for this payment');
      return;
    }

    const newBalance = currentBalance - amount;
    const transactionDate = new Date(payBillsForm.datetime);
    
    const newTransaction = {
      id: Date.now(),
      accountId: accountId,
      amount: `-${amount.toFixed(2)}`,
      description: payBillsForm.payee,
      category: 'bill_payment',
      type: 'debit',
      paymentMethod: 'Bill Payment',
      reference: `BP${Date.now()}`,
      timestamp: transactionDate.toISOString(),
      payee: payBillsForm.payee
    };

    const currentTransactions = UserDataManager.getUserData('bankTransactions', []);
    const updatedTransactions = [...currentTransactions, newTransaction];
    
    updatedTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    UserDataManager.setUserData('bankTransactions', updatedTransactions);
    
    const newBalanceString = newBalance.toFixed(2);
    setBalance(newBalanceString);

    const accounts = UserDataManager.getUserAccounts();
    const updatedAccounts = accounts.map((acc: Account) =>
      acc.id === accountId ? { ...acc, balance: newBalanceString } : acc
    );
    UserDataManager.setUserData('bankAccounts', updatedAccounts);

    // Persist the deduction and the transaction record to the server
    // (queued while offline). Bill payments used to live only in
    // localStorage, so the balance change reverted on the next dashboard
    // load and the transaction could never be deleted server-side.
    syncBalanceToServer(String(accountId), newBalanceString);
    syncTransactionToServer(Number(accountId), newTransaction as any);

    const accountTransactions = updatedTransactions.filter(t => t.accountId === accountId);
    setTransactions(accountTransactions);
    
    setPayBillsForm({ payee: '', amount: '', datetime: '' });
    setShowPayBillsForm(false);
    
    const currencySymbol = getCurrencySymbol(userCurrency);
    alert(`Payment of ${currencySymbol} ${amount.toFixed(2)} to ${payBillsForm.payee} has been processed successfully.`);
  };

  const handleOpenStatement = () => {
    if (!statementPdfBlob) return;
    const url = window.URL.createObjectURL(statementPdfBlob);
    window.open(url, '_blank');
  };

  const handleOpenTransferConfirmation = async () => {
    if (!selectedTransaction) {
      return;
    }

    const openPdfBlob = (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Transfer-Document-${selectedTransaction?.reference || Date.now()}.pdf`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 500);
    };

    try {
      if (selectedTransaction.confirmationPdfData) {
        const byteCharacters = atob(selectedTransaction.confirmationPdfData.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        openPdfBlob(blob);
        return;
      }

      const userProfile = UserDataManager.getUserProfile();
      const accounts = UserDataManager.getUserAccounts();
      const accountInfoData = accounts.find((acc: any) => acc.id === selectedTransaction.accountId);
      
      const response = await fetch('/api/generate-transfer-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction: selectedTransaction,
          senderName: userProfile?.name || 'Customer',
          accountInfo: accountInfoData?.displayName || 'Account',
          userCurrency: userProfile?.currency || 'EUR'
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        openPdfBlob(blob);
      } else {
        alert('Failed to generate transfer document');
      }
    } catch (error) {
      console.error('Failed to open transfer document:', error);
      alert('Error opening transfer document');
    }
  };

  const handleAllowPopup = () => {
    if (pendingPdfUrl) {
      const newWindow = window.open(pendingPdfUrl, '_blank');
      if (newWindow) {
        setShowPopupBlockedModal(false);
        setTimeout(() => {
          window.URL.revokeObjectURL(pendingPdfUrl);
          setPendingPdfUrl(null);
        }, 100);
      } else {
        // Popup still blocked - use download fallback
        handleDownloadConfirmation();
      }
    }
  };

  const handleDownloadConfirmation = () => {
    if (pendingPdfUrl) {
      const link = document.createElement('a');
      link.href = pendingPdfUrl;
      link.download = `transfer-confirmation-${selectedTransaction?.reference || Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setShowPopupBlockedModal(false);
      setTimeout(() => {
        if (pendingPdfUrl) {
          window.URL.revokeObjectURL(pendingPdfUrl);
        }
        setPendingPdfUrl(null);
      }, 100);
    }
  };

  const handleClosePopupModal = () => {
    if (pendingPdfUrl) {
      window.URL.revokeObjectURL(pendingPdfUrl);
      setPendingPdfUrl(null);
    }
    setShowPopupBlockedModal(false);
  };

  const handleSaveStatement = () => {
    if (!statementPdfBlob || !statementFileName) return;
    const url = window.URL.createObjectURL(statementPdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = statementFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleShareStatement = async () => {
    if (!statementPdfBlob || !statementFileName) return;
    
    if (navigator.share && navigator.canShare && navigator.canShare()) {
      try {
        const file = new File([statementPdfBlob], statementFileName, { type: 'application/pdf' });
        await navigator.share({
          title: 'Bank Statement',
          text: 'Your bank statement',
          files: [file]
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.log('Share failed, falling back to save');
          handleSaveStatement();
        } else {
          console.log('Share cancelled by user');
        }
      }
    } else {
      handleSaveStatement();
    }
  };

  const handleCloseStatementSuccess = () => {
    if (statementPdfBlob) {
      const blobUrl = window.URL.createObjectURL(statementPdfBlob);
      window.URL.revokeObjectURL(blobUrl);
    }
    
    setShowStatementModal(false);
    setStatementSuccessState(false);
    setStatementPdfBlob(null);
    setStatementFileName('');
    setStatementError('');
  };

  const handleGenerateStatement = async () => {
    const fromDate = new Date(statementDateRange.from);
    const toDate = new Date(statementDateRange.to);
    
    if (fromDate > toDate) {
      setStatementError('From date must be before or equal to To date');
      return;
    }
    
    setIsGeneratingStatement(true);
    setStatementError('');
    
    try {
      const userData = UserDataManager.getUserProfile();
      
      // Fetch fresh transactions from database (same as transaction history does)
      let allTransactions = UserDataManager.getUserData('bankTransactions', []);
      try {
        const txResponse = await fetch(`/api/transactions/${accountId}`, { credentials: 'include' });
        if (txResponse.ok) {
          const dbTransactions = await txResponse.json();
          // Merge with local transactions
          const existingTxIds = new Set(allTransactions.map((tx: any) => String(tx.id)));
          const newTransactions = dbTransactions.filter((dbTx: any) => 
            !existingTxIds.has(String(dbTx.id))
          );
          if (newTransactions.length > 0) {
            allTransactions = [...allTransactions, ...newTransactions];
            UserDataManager.setUserData('bankTransactions', allTransactions);
          }
          console.log(`📄 Statement: Synced ${dbTransactions.length} transactions from database`);
        }
      } catch (fetchError) {
        console.log('Statement: Using cached transactions');
      }
      
      // Fetch fresh accounts from database
      let allAccounts = UserDataManager.getUserAccounts();
      try {
        const accResponse = await fetch('/api/accounts', { credentials: 'include' });
        if (accResponse.ok) {
          const dbAccounts = await accResponse.json();
          if (dbAccounts && dbAccounts.length > 0) {
            // Protect any accounts with pending local balance syncs
            const pendingSyncs = getPendingBalanceSyncs();
            const protectedAccounts = dbAccounts.map((acc: any) => {
              const id = String(acc.id);
              return pendingSyncs[id] ? { ...acc, balance: pendingSyncs[id] } : acc;
            });
            allAccounts = protectedAccounts;
            UserDataManager.setUserData('bankAccounts', protectedAccounts);
          }
          console.log(`📄 Statement: Synced ${dbAccounts.length} accounts from database`);
        }
      } catch (fetchError) {
        console.log('Statement: Using cached accounts');
      }
      
      const emailsEnabled = localStorage.getItem('emailsEnabled');
      const sendEmail = emailsEnabled !== null ? JSON.parse(emailsEnabled) : true;

      const requestPayload = {
        accountId: String(accountId),
        startDate: statementDateRange.from,
        endDate: statementDateRange.to,
        dateRange: `${fromDate.toLocaleDateString('en-IE')} to ${toDate.toLocaleDateString('en-IE')}`,
        customerName: userData?.name || '',
        userAddress: userData?.address || '',
        userEmail: userData?.email || '',
        userCurrency: userCurrency,
        userTransactions: allTransactions,
        userAccounts: allAccounts,
        emailsEnabled: sendEmail
      };
      
      const response = await fetch('/api/generate-statement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (response.ok) {
        const blob = await response.blob();
        const fileName = `BOI_Statement_${statementDateRange.from}_to_${statementDateRange.to}.pdf`;
        
        setStatementPdfBlob(blob);
        setStatementFileName(fileName);
        setStatementSuccessState(true);
      } else {
        const errorData = await response.json();
        setStatementError(errorData.message || 'Failed to generate statement');
      }
    } catch (error) {
      console.error('Error generating statement:', error);
      setStatementError('An error occurred while generating the statement');
    } finally {
      setIsGeneratingStatement(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction) return;
    
    try {
      // Call backend API to delete transaction and update balance on server
      const response = await fetch(`/api/transactions/${selectedTransaction.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      let serverNewBalance: string;

      if (response.ok) {
        const result = await response.json();
        serverNewBalance = result.newBalance;
      } else if (response.status === 404) {
        // Not on the server - a local-only transaction (e.g. created before
        // transactions were synced server-side). Previously this returned
        // early and the delete button silently did nothing. Reverse the
        // amount against the local balance and push that to the server
        // (queued if offline) so the dashboard doesn't revert it later.
        const accounts = UserDataManager.getUserAccounts();
        const affected = accounts.find((acc: Account) => acc.id === accountId);
        if (!affected) {
          console.error('Account not found for local transaction delete');
          return;
        }
        const amountNum = parseFloat(String(selectedTransaction.amount).replace('-', '').replace('+', ''));
        const isDebit = String(selectedTransaction.amount).startsWith('-') || selectedTransaction.type === 'debit';
        const reversed = isDebit
          ? parseFloat(affected.balance) + amountNum
          : parseFloat(affected.balance) - amountNum;
        serverNewBalance = reversed.toFixed(2);
        syncBalanceToServer(String(accountId), serverNewBalance);
        // If this transaction was still queued for server sync, cancel it
        // so it doesn't get pushed (and reappear) on reconnect
        cancelPendingTransactionSync(selectedTransaction.id);
      } else {
        // Server has the transaction but couldn't delete it - don't touch
        // local state, or the two sides would disagree.
        console.error('Failed to delete transaction on server');
        return;
      }

      // Update local state with the confirmed balance
      setBalance(serverNewBalance);
      
      // Update accounts in localStorage with the server-confirmed balance
      const accounts = UserDataManager.getUserAccounts();
      const updatedAccounts = accounts.map((acc: Account) => 
        acc.id === accountId ? { ...acc, balance: serverNewBalance } : acc
      );
      UserDataManager.setUserData('bankAccounts', updatedAccounts);
      
      // Mark transaction as deleted in local transactions cache
      const allTransactions = UserDataManager.getUserData('bankTransactions', []);
      const enhancedTransactions = allTransactions.map((tx: any) => {
        if (tx.id === selectedTransaction.id) {
          return { ...tx, deleted: true };
        }
        return tx;
      });
      UserDataManager.setUserData('bankTransactions', enhancedTransactions);
      
      // Update displayed transactions
      const accountTransactions = enhancedTransactions.filter((tx: any) => tx.accountId === accountId);
      setTransactions(accountTransactions);
      
      setSelectedTransaction(null);
      setShowDeleteConfirm(false);
      
      // Dispatch events to update other components with server-confirmed balance
      window.dispatchEvent(new CustomEvent('transactionDeleted', {
        detail: { transactionId: selectedTransaction?.id, newBalance: serverNewBalance }
      }));
      window.dispatchEvent(new CustomEvent('balanceUpdate', {
        detail: { accountId, newBalance: serverNewBalance, accounts: updatedAccounts }
      }));
      window.dispatchEvent(new CustomEvent('transactionUpdate'));
      
      console.log(`🗑️ Transaction ${selectedTransaction.id} deleted, balance updated to ${serverNewBalance}`);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  useEffect(() => {
    // Helper function to process and display transactions
    const displayTransactions = (allTransactions: any[]) => {
      const updatedTransactions = (allTransactions || []).map((tx: any) => {
        if (tx.paymentMethod === 'UK Transfer' && !tx.exchangeRate) {
          const amount = parseFloat(tx.amount.replace('-', ''));
          const sampleRate = 0.8456;
          return {
            ...tx,
            exchangeRate: sampleRate,
            convertedAmount: (amount * sampleRate).toFixed(2),
            convertedCurrency: 'GBP'
          };
        }
        return tx;
      });
      
      // Filter transactions for this account (handle string/number ID mismatch)
      const accountTransactions = updatedTransactions.filter((tx: any) => 
        String(tx.accountId) === String(accountId)
      );
      
      const formattedStored = accountTransactions.map((tx: any) => ({
        ...tx,
        id: tx.id,
        amount: tx.amount,
        description: tx.description,
        timestamp: tx.timestamp,
        type: tx.type
      }));
      
      const sortedTransactions = formattedStored.sort((a: any, b: any) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setTransactions(sortedTransactions);
      return updatedTransactions;
    };
    
    const loadData = () => {
      UserDataManager.clearCache('bankTransactions');
      UserDataManager.clearCache('bankAccounts');
      
      // IMMEDIATELY load and display cached data first (no delay)
      const storedTransactions = UserDataManager.getUserData('bankTransactions', []) || [];
      const storedAccounts = UserDataManager.getUserData('bankAccounts', []) || [];
      
      setUserCurrency(getUserCurrency());
      
      // Set account info and balance immediately from cache
      if (Array.isArray(storedAccounts) && storedAccounts.length > 0) {
        const currentAccount = storedAccounts.find((acc: any) => 
          String(acc.id) === String(accountId)
        );
        
        if (currentAccount) {
          setBalance(currentAccount.balance || '0.00');
          setAccountInfo(currentAccount);
        } else {
          console.log('Account not found, redirecting to dashboard');
          setLocation('/dashboard');
          return;
        }
      } else {
        console.log('No accounts found, redirecting to dashboard');
        setLocation('/dashboard');
        return;
      }
      
      // Display cached transactions immediately
      const processedTransactions = displayTransactions(storedTransactions);
      UserDataManager.setUserData('bankTransactions', processedTransactions);
      
      console.log('Loaded transactions for account', accountId);
      
      // THEN sync from database in the background (non-blocking)
      fetch(`/api/transactions/${accountId}`, { credentials: 'include' })
        .then(response => {
          if (response.ok) return response.json();
          throw new Error('Failed to fetch');
        })
        .then(dbTransactions => {
          // Get current local storage transactions
          const currentStored = UserDataManager.getUserData('bankTransactions', []) || [];
          const existingTxIds = new Set(currentStored.map((tx: any) => String(tx.id)));
          // Also dedupe by unique reference - a locally-created transfer
          // that was synced to the server has a server-assigned id there,
          // so id-matching alone would re-import it as a "new" transaction
          const existingRefs = new Set(
            currentStored.map((tx: any) => tx.reference).filter(Boolean)
          );

          // Find new transactions from database (including internal transfer credits)
          const newTransactions = dbTransactions.filter((dbTx: any) =>
            !existingTxIds.has(String(dbTx.id)) &&
            !(dbTx.reference && existingRefs.has(dbTx.reference))
          );
          
          if (newTransactions.length > 0) {
            console.log(`📥 Synced ${newTransactions.length} new transactions from database`);
            const mergedTransactions = [...currentStored, ...newTransactions];
            UserDataManager.setUserData('bankTransactions', mergedTransactions);
            
            // Update display with new transactions
            displayTransactions(mergedTransactions);
          }
        })
        .catch(error => {
          console.log('Background sync skipped:', error.message);
        });
    };
    
    loadData();

    const handleTransactionUpdate = () => {
      loadData();
    };

    const handleAccountsUpdate = (event: CustomEvent) => {
      const { accounts: updatedAccounts, source } = event.detail || {};
      if (source === 'accountDeleted' && updatedAccounts) {
        // Check if current account still exists (handle string/number ID mismatch)
        const accountExists = updatedAccounts.find((acc: any) => 
          String(acc.id) === String(accountId)
        );
        if (!accountExists) {
          console.log('Current account deleted, redirecting to dashboard');
          setLocation('/dashboard');
          return;
        }
      }
      loadData();
    };

    window.addEventListener('transactionUpdate', handleTransactionUpdate);
    window.addEventListener('transactionDeleted', handleTransactionUpdate);
    window.addEventListener('transactionAdded', handleTransactionUpdate);
    window.addEventListener('balanceUpdate', handleTransactionUpdate);
    window.addEventListener('accountsUpdate', handleAccountsUpdate as EventListener);
    
    return () => {
      window.removeEventListener('transactionUpdate', handleTransactionUpdate);
      window.removeEventListener('transactionDeleted', handleTransactionUpdate);
      window.removeEventListener('transactionAdded', handleTransactionUpdate);
      window.removeEventListener('balanceUpdate', handleTransactionUpdate);
      window.removeEventListener('accountsUpdate', handleAccountsUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    const currentRoute = `/transactions/${accountId}`;
    
    StateManager.restoreScrollPosition(currentRoute, '.transaction-scroll-container');
    
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        StateManager.saveScrollPosition(currentRoute, scrollContainerRef.current.scrollTop);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [accountId]);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getAccountNumber = () => {
    return accountInfo?.accountNumber?.replace('****', '') || '2091';
  };

  const styles = {
    colors: {
      headerBg: '#126987',
      balanceGradientStart: '#0E5C75',
      balanceGradientEnd: '#154B63',
      tabActiveBg: '#256775',
      tabInactiveBorder: '#D6D6D6',
      tabBg: '#FFFFFF',
      filterBg: '#F9F9F9',
      completedText: '#1B6B7C',
      completedUnderline: '#1B6B7C',
      goldInfoIcon: '#B8860B',
      amountPositive: '#16A34A',
      amountNegative: '#1F2937',
      textPrimary: '#1F2937',
      textSecondary: '#4B5563',
      textMuted: '#6B7280',
      textWhite: '#FFFFFF',
      profileBorder: '#7DD3E8',
      profileBg: 'rgba(27, 107, 124, 0.35)',
      dividerLight: '#E5E7EB',
      bannerBg: '#1B6B7C',
    },
    fonts: {
      family: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', sans-serif",
    }
  };

  return (
    <div 
      className="page-container h-screen bg-white flex flex-col overflow-hidden" 
      style={{ fontFamily: styles.fonts.family, maxWidth: '100%', width: '100%', margin: '0 auto' }}
    >
      {/* Header - matches status bar color */}
      <div 
        className="flex items-center justify-between flex-shrink-0"
        style={{ 
          background: styles.colors.headerBg,
          minHeight: '48px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingBottom: '8px'
        }}
      >
        <button 
          onClick={() => navigateWithAnimation('/dashboard', 'slide-left')}
          className="flex items-center justify-center"
          style={{ width: '40px', height: '40px' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        
        <h1 style={{ 
          fontSize: '17px', 
          fontWeight: 600, 
          color: styles.colors.textWhite, 
          letterSpacing: '-0.2px'
        }}>
          {accountInfo?.displayName || 'Current Account'} ~ {getAccountNumber()}
        </h1>
        
        <button 
          onClick={() => navigateWithAnimation('/profile', 'slide-up')}
          className="text-white hover:bg-white/20 h-8 w-8 rounded-full flex items-center justify-center touch-manipulation transform-gpu transition-all duration-150 ease-out active:scale-95 android-no-highlight"
          style={{
            WebkitTapHighlightColor: 'transparent',
            outline: 'none'
          }}
        >
          <User className="h-5 w-5" />
        </button>
      </div>

      {/* Balance Section - padding: 16px top, 24px bottom, 20px sides */}
      {/* Balance Section */}
      <div 
        style={{ 
          background: 'linear-gradient(to bottom right, #1A4D5F 0%, #265770 22%, #2C5D73 45%, #53879F 72%, #669CB0 100%)',
          padding: '16px 20px 24px 20px'
        }}
      >
        <div className="flex items-center" style={{ gap: '8px', marginBottom: '16px' }}>
          <span style={{ 
            fontSize: '32px', 
            fontWeight: 700, 
            color: styles.colors.textWhite,
            letterSpacing: '-0.5px',
            lineHeight: 1.1
          }}>
            {formatCurrency(balance, userCurrency)}
          </span>
          <button className="flex items-center justify-center" style={{ marginTop: '4px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
        
        <div style={{ 
          width: '36px', 
          height: '2px', 
          backgroundColor: 'rgba(255,255,255,0.5)', 
          marginBottom: showBankDetailsButton ? '14px' : '0px' 
        }} />
        
        {showBankDetailsButton && (
          <button 
            onClick={() => setShowAccountDetailsModal(true)}
            className="flex items-center" 
            style={{ gap: '4px' }}
          >
            <span style={{ fontSize: '15px', fontWeight: 400, color: styles.colors.textWhite }}>{userCurrency === 'GBP' ? 'Sort Code / Account Number' : 'BIC / IBAN'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        )}
      </div>

      {/* Tabs - white background, proper spacing */}
      <div style={{ 
        backgroundColor: '#FFFFFF', 
        padding: '16px 16px 20px 16px', 
        display: 'flex', 
        gap: '8px',
        justifyContent: 'flex-start',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Transactions Tab */}
        <div style={{ position: 'relative', flexShrink: 1 }}>
          <button
            onClick={() => setActiveTab('transactions')}
            style={{
              padding: '9px 16px',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: 500,
              backgroundColor: activeTab === 'transactions' ? '#306785' : '#FFFFFF',
              color: activeTab === 'transactions' ? '#FFFFFF' : '#4A4A4A',
              border: activeTab === 'transactions' ? 'none' : '1.5px solid #D0D0D0',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap'
            }}
          >
            Transactions
          </button>
          {activeTab === 'transactions' && (
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: '14px',
              height: '14px',
              backgroundColor: '#306785',
              borderRadius: '3px'
            }} />
          )}
        </div>

        {/* Statements Tab */}
        <div style={{ position: 'relative', flexShrink: 1 }}>
          <button
            onClick={() => {
              setActiveTab('statements');
              setShowStatementModal(true);
            }}
            style={{
              padding: '9px 16px',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: 500,
              backgroundColor: activeTab === 'statements' ? '#306785' : '#FFFFFF',
              color: activeTab === 'statements' ? '#FFFFFF' : '#4A4A4A',
              border: activeTab === 'statements' ? 'none' : '1.5px solid #D0D0D0',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap'
            }}
          >
            Statements
          </button>
          {activeTab === 'statements' && (
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: '14px',
              height: '14px',
              backgroundColor: '#306785',
              borderRadius: '3px'
            }} />
          )}
        </div>

        {/* More options Tab */}
        <div style={{ position: 'relative', flexShrink: 1 }}>
          <button
            onClick={() => setActiveTab('more')}
            style={{
              padding: '9px 16px',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: 500,
              backgroundColor: activeTab === 'more' ? '#306785' : '#FFFFFF',
              color: activeTab === 'more' ? '#FFFFFF' : '#4A4A4A',
              border: activeTab === 'more' ? 'none' : '1.5px solid #D0D0D0',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap'
            }}
          >
            More options
          </button>
          {activeTab === 'more' && (
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: '14px',
              height: '14px',
              backgroundColor: '#306785',
              borderRadius: '3px'
            }} />
          )}
        </div>
      </div>

      {/* Scrollable Content Area - contains filter and transactions */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        style={{ backgroundColor: '#FFFFFF' }}
        data-scroll-container
        data-scroll-route={`/transactions/${accountId}`}
      >
        {/* More Options Content */}
        {activeTab === 'more' && (
          <div style={{ padding: '20px' }}>
            {/* Cheques Section */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '16px' }}>
                <span style={{ 
                  fontSize: '18px', 
                  fontWeight: 400, 
                  color: '#1a5490'
                }}>Cheques</span>
                <div style={{ 
                  position: 'absolute',
                  left: 0,
                  bottom: '-4px',
                  width: '40px',
                  height: '2px',
                  backgroundColor: '#1a5490'
                }} />
              </div>
              
              <button 
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 0',
                  borderBottom: '1px solid #E5E5E5',
                  backgroundColor: 'transparent'
                }}
              >
                <span style={{ fontSize: '16px', color: '#333' }}>Search cheque</span>
                <ChevronRight size={20} color="#999" />
              </button>
            </div>

            {/* Account settings Section */}
            <div>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '16px' }}>
                <span style={{ 
                  fontSize: '18px', 
                  fontWeight: 400, 
                  color: '#1a5490'
                }}>Account settings</span>
                <div style={{ 
                  position: 'absolute',
                  left: 0,
                  bottom: '-4px',
                  width: '40px',
                  height: '2px',
                  backgroundColor: '#1a5490'
                }} />
              </div>
              
              <button 
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 0',
                  borderBottom: '1px solid #E5E5E5',
                  backgroundColor: 'transparent'
                }}
              >
                <span style={{ fontSize: '16px', color: '#333' }}>Account nickname</span>
                <ChevronRight size={20} color="#999" />
              </button>
            </div>
          </div>
        )}

        {/* Transactions Tab Content */}
        {activeTab === 'transactions' && (
          <>
        {/* Filter Section - height 48px */}
        <div style={{ 
          backgroundColor: styles.colors.filterBg, 
          padding: '14px 20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-end' 
        }}>
          <button 
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center" 
            style={{ gap: '10px' }}
          >
            <span style={{ 
              fontSize: '15px', 
              fontWeight: 600, 
              color: styles.colors.textMuted 
            }}>
              Filter completed transactions
            </span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={styles.colors.completedText} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </div>

        {/* Filter Panel */}
      {showFilterPanel && (
        <div style={{ 
          backgroundColor: '#FFFFFF', 
          padding: '16px 20px 20px 20px',
          borderBottom: '1px solid #E5E5E5'
        }}>
          {/* Close button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button 
              onClick={() => {
                setShowFilterPanel(false);
                setShowTypeDropdown(false);
                setShowMonthDropdown(false);
              }}
              style={{ padding: '4px' }}
            >
              <X size={22} color="#666" strokeWidth={2.5} />
            </button>
          </div>

          {/* Month/date range */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '16px', fontWeight: 500, color: '#333', marginBottom: '12px' }}>
              Month/date range
            </p>
            <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid #D0D0D0' }}>
              <button
                onClick={() => setDateRangeType('all')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  fontSize: '15px',
                  fontWeight: 500,
                  backgroundColor: dateRangeType === 'all' ? '#126987' : '#FFFFFF',
                  color: dateRangeType === 'all' ? '#FFFFFF' : '#333',
                  border: 'none',
                  borderRight: '1px solid #D0D0D0'
                }}
              >
                All
              </button>
              <button
                onClick={() => setDateRangeType('month')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  fontSize: '15px',
                  fontWeight: 500,
                  backgroundColor: dateRangeType === 'month' ? '#126987' : '#FFFFFF',
                  color: dateRangeType === 'month' ? '#FFFFFF' : '#333',
                  border: 'none',
                  borderRight: '1px solid #D0D0D0'
                }}
              >
                Month
              </button>
              <button
                onClick={() => setDateRangeType('daterange')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  fontSize: '15px',
                  fontWeight: 500,
                  backgroundColor: dateRangeType === 'daterange' ? '#126987' : '#FFFFFF',
                  color: dateRangeType === 'daterange' ? '#FFFFFF' : '#333',
                  border: 'none'
                }}
              >
                Date range
              </button>
            </div>

            {/* Month selector */}
            {dateRangeType === 'month' && (
              <div style={{ marginTop: '16px' }}>
                <p style={{ fontSize: '16px', fontWeight: 500, color: '#333', marginBottom: '8px' }}>
                  Select month
                </p>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: '15px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D0D0D0',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ color: selectedMonth ? '#333' : '#666' }}>
                      {selectedMonth ? (() => {
                        const [year, month] = selectedMonth.split('-');
                        const date = new Date(parseInt(year), parseInt(month) - 1);
                        return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                      })() : 'Please select a month'}
                    </span>
                    <ChevronRight 
                      size={20} 
                      color="#126987" 
                      style={{ 
                        transform: showMonthDropdown ? 'rotate(-90deg)' : 'rotate(90deg)',
                        transition: 'transform 0.2s'
                      }} 
                    />
                  </button>

                  {/* Month Dropdown */}
                  {showMonthDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D0D0D0',
                      borderTop: 'none',
                      borderRadius: '0 0 4px 4px',
                      zIndex: 10,
                      maxHeight: '250px',
                      overflowY: 'auto'
                    }}>
                      <button
                        onClick={() => {
                          setSelectedMonth('');
                          setShowMonthDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          fontSize: '15px',
                          backgroundColor: !selectedMonth ? '#F0F7FC' : '#FFFFFF',
                          border: 'none',
                          borderBottom: '1px solid #F0F0F0',
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: '#666'
                        }}
                      >
                        Please select a month
                      </button>
                      {(() => {
                        const months = [];
                        const now = new Date();
                        for (let i = 0; i < 24; i++) {
                          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                          const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                          const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                          months.push({ value, label });
                        }
                        return months.map((month) => (
                          <button
                            key={month.value}
                            onClick={() => {
                              setSelectedMonth(month.value);
                              setShowMonthDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '14px 16px',
                              fontSize: '15px',
                              backgroundColor: selectedMonth === month.value ? '#F0F7FC' : '#FFFFFF',
                              border: 'none',
                              borderBottom: '1px solid #F0F0F0',
                              textAlign: 'left',
                              cursor: 'pointer'
                            }}
                          >
                            {month.label}
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Date range selector */}
            {dateRangeType === 'daterange' && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '16px', fontWeight: 500, color: '#333', marginBottom: '8px', display: 'block' }}>From</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '14px 50px 14px 16px',
                        fontSize: '15px',
                        border: '1px solid #D0D0D0',
                        borderRadius: '4px',
                        outline: 'none',
                        WebkitAppearance: 'none',
                        appearance: 'none'
                      }}
                    />
                    <svg 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="#126987" 
                      strokeWidth="2"
                      style={{ 
                        position: 'absolute', 
                        right: '16px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none'
                      }}
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '16px', fontWeight: 500, color: '#333', marginBottom: '8px', display: 'block' }}>To</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '14px 50px 14px 16px',
                        fontSize: '15px',
                        border: '1px solid #D0D0D0',
                        borderRadius: '4px',
                        outline: 'none',
                        WebkitAppearance: 'none',
                        appearance: 'none'
                      }}
                    />
                    <svg 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="#126987" 
                      strokeWidth="2"
                      style={{ 
                        position: 'absolute', 
                        right: '16px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none'
                      }}
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Transaction type */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '16px', fontWeight: 500, color: '#333', marginBottom: '12px' }}>
              Transaction type
            </p>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '15px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D0D0D0',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'left'
                }}
              >
                <span>{transactionTypes.find(t => t.value === transactionType)?.label || 'All'}</span>
                <ChevronRight 
                  size={20} 
                  color="#1a5490" 
                  style={{ 
                    transform: showTypeDropdown ? 'rotate(-90deg)' : 'rotate(90deg)',
                    transition: 'transform 0.2s'
                  }} 
                />
              </button>

              {/* Dropdown */}
              {showTypeDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D0D0D0',
                  borderTop: 'none',
                  borderRadius: '0 0 4px 4px',
                  zIndex: 10,
                  maxHeight: '250px',
                  overflowY: 'auto'
                }}>
                  {transactionTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setTransactionType(type.value);
                        setShowTypeDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        fontSize: '15px',
                        backgroundColor: transactionType === type.value ? '#F0F7FC' : '#FFFFFF',
                        border: 'none',
                        borderBottom: '1px solid #F0F0F0',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter button */}
          <button
            onClick={() => {
              setActiveFilters({
                dateRangeType,
                transactionType,
                month: selectedMonth,
                dateFrom,
                dateTo
              });
              setShowFilterPanel(false);
              setShowTypeDropdown(false);
              setShowMonthDropdown(false);
            }}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: 600,
              backgroundColor: '#126987',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Filter
          </button>
        </div>
      )}

      {/* Status Heading and Amount Header */}
      <div style={{ 
        backgroundColor: '#FFFFFF', 
        padding: '16px 20px 12px 20px', 
        display: 'flex', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between' 
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ 
              fontSize: '20px', 
              fontWeight: 500, 
              color: '#306785'
            }}>Completed</span>
            <div style={{ 
              position: 'absolute',
              left: 0,
              bottom: '-6px',
              width: '60px',
              height: '3px',
              backgroundColor: '#306785',
              borderRadius: '1.5px'
            }} />
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#306785" stroke="none" style={{ marginLeft: '2px' }}>
            <circle cx="12" cy="12" r="10" fill="#306785"/>
            <line x1="12" y1="16" x2="12" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="8" r="1" fill="white"/>
          </svg>
        </div>
        <span style={{ 
          fontSize: '13px', 
          fontWeight: 400, 
          color: styles.colors.textMuted,
          marginTop: '4px'
        }}>
          Amount in {userCurrency === 'EUR' ? '€' : '£'}
        </span>
      </div>

      {/* Transaction List */}
        <div>
          {transactions
            .filter(t => !t.deleted)
            .filter(t => {
              if (!activeFilters) return true;
              
              const txDate = new Date(t.timestamp);
              
              // Date range filter
              if (activeFilters.dateRangeType === 'month' && activeFilters.month) {
                const [year, month] = activeFilters.month.split('-').map(Number);
                if (txDate.getFullYear() !== year || txDate.getMonth() + 1 !== month) {
                  return false;
                }
              }
              
              if (activeFilters.dateRangeType === 'daterange') {
                if (activeFilters.dateFrom) {
                  const fromDate = new Date(activeFilters.dateFrom);
                  fromDate.setHours(0, 0, 0, 0);
                  if (txDate < fromDate) return false;
                }
                if (activeFilters.dateTo) {
                  const toDate = new Date(activeFilters.dateTo);
                  toDate.setHours(23, 59, 59, 999);
                  if (txDate > toDate) return false;
                }
              }
              
              // Transaction type filter
              if (activeFilters.transactionType !== 'all') {
                const category = (t.category || '').toLowerCase();
                const paymentMethod = (t.paymentMethod || '').toLowerCase();
                const description = (t.description || '').toLowerCase();
                
                switch (activeFilters.transactionType) {
                  case 'direct_debit':
                    if (!category.includes('direct') && !paymentMethod.includes('direct')) return false;
                    break;
                  case 'contactless':
                    if (!paymentMethod.includes('contactless') && !category.includes('contactless')) return false;
                    break;
                  case 'atm':
                    if (!category.includes('atm') && !description.includes('atm') && !paymentMethod.includes('atm')) return false;
                    break;
                  case 'lodgement':
                    if (t.type !== 'credit' && !category.includes('lodgement') && !category.includes('credit')) return false;
                    break;
                  case 'credit_transfer':
                    if (!category.includes('transfer') && !paymentMethod.includes('transfer')) return false;
                    break;
                  case 'cheque':
                    if (!category.includes('cheque') && !paymentMethod.includes('cheque')) return false;
                    break;
                  case 'other_debit':
                    if (t.type !== 'debit') return false;
                    break;
                  case 'cash_withdrawal':
                    if (!category.includes('cash') && !description.includes('withdrawal')) return false;
                    break;
                }
              }
              
              return true;
            })
            .map((transaction, index) => {
            const isDebit = transaction.type === 'debit' || transaction.amount.startsWith('-');
            const amount = Math.abs(parseFloat(transaction.amount.replace('-', '')));
            
            return (
              <div 
                key={`${transaction.id}-${index}`}
                onClick={() => setSelectedTransaction(transaction)}
                className="active:bg-gray-100 transition-colors cursor-pointer flex items-start justify-between"
                style={{ 
                  padding: '18px 20px',
                  borderBottom: `1px solid ${styles.colors.dividerLight}`,
                  backgroundColor: 'white'
                }}
              >
                {/* Left side */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ 
                    fontSize: '16px', 
                    fontWeight: 600, 
                    color: styles.colors.textPrimary, 
                    marginBottom: '4px', 
                    lineHeight: 1.25
                  }}>
                    {transaction.description || transaction.reference || transaction.id}
                  </p>
                  <p style={{ 
                    fontSize: '14px', 
                    fontWeight: 400, 
                    color: styles.colors.textSecondary, 
                    marginBottom: '4px', 
                    lineHeight: 1.25
                  }}>
                    {transaction.id}
                  </p>
                  <p style={{ 
                    fontSize: '14px', 
                    fontWeight: 400, 
                    color: styles.colors.textMuted, 
                    lineHeight: 1.25
                  }}>
                    {formatDate(transaction.timestamp)}
                  </p>
                </div>

                {/* Right side */}
                <div className="flex items-center" style={{ gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ 
                      fontSize: '16px', 
                      fontWeight: 500, 
                      marginBottom: '4px',
                      color: isDebit ? styles.colors.amountNegative : styles.colors.amountPositive,
                      lineHeight: 1.25
                    }}>
                      {isDebit ? '' : '+ '}{amount.toFixed(2)}
                    </p>
                    <p style={{ 
                      fontSize: '12px', 
                      fontWeight: 400, 
                      color: styles.colors.textMuted, 
                      fontStyle: 'italic', 
                      lineHeight: 1.25
                    }}>
                      View details
                    </p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={styles.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            );
          })}
          
          {transactions
            .filter(t => !t.deleted)
            .filter(t => {
              if (!activeFilters) return true;
              
              const txDate = new Date(t.timestamp);
              
              if (activeFilters.dateRangeType === 'month' && activeFilters.month) {
                const [year, month] = activeFilters.month.split('-').map(Number);
                if (txDate.getFullYear() !== year || txDate.getMonth() + 1 !== month) {
                  return false;
                }
              }
              
              if (activeFilters.dateRangeType === 'daterange') {
                if (activeFilters.dateFrom) {
                  const fromDate = new Date(activeFilters.dateFrom);
                  fromDate.setHours(0, 0, 0, 0);
                  if (txDate < fromDate) return false;
                }
                if (activeFilters.dateTo) {
                  const toDate = new Date(activeFilters.dateTo);
                  toDate.setHours(23, 59, 59, 999);
                  if (txDate > toDate) return false;
                }
              }
              
              if (activeFilters.transactionType !== 'all') {
                const category = (t.category || '').toLowerCase();
                const paymentMethod = (t.paymentMethod || '').toLowerCase();
                const description = (t.description || '').toLowerCase();
                
                switch (activeFilters.transactionType) {
                  case 'direct_debit':
                    if (!category.includes('direct') && !paymentMethod.includes('direct')) return false;
                    break;
                  case 'contactless':
                    if (!paymentMethod.includes('contactless') && !category.includes('contactless')) return false;
                    break;
                  case 'atm':
                    if (!category.includes('atm') && !description.includes('atm') && !paymentMethod.includes('atm')) return false;
                    break;
                  case 'lodgement':
                    if (t.type !== 'credit' && !category.includes('lodgement') && !category.includes('credit')) return false;
                    break;
                  case 'credit_transfer':
                    if (!category.includes('transfer') && !paymentMethod.includes('transfer')) return false;
                    break;
                  case 'cheque':
                    if (!category.includes('cheque') && !paymentMethod.includes('cheque')) return false;
                    break;
                  case 'other_debit':
                    if (t.type !== 'debit') return false;
                    break;
                  case 'cash_withdrawal':
                    if (!category.includes('cash') && !description.includes('withdrawal')) return false;
                    break;
                }
              }
              
              return true;
            }).length === 0 && (
            <div className="px-4 py-12 text-center" style={{ color: styles.colors.textMuted }}>
              <p>{activeFilters ? 'No transactions match your filter criteria' : 'No transactions found'}</p>
            </div>
          )}
        </div>
        </>
        )}
      </div>


      {/* Bottom Navigation */}
      <div className="bg-white border-t border-gray-200 px-2 py-2 flex justify-around items-center flex-shrink-0">
        <button 
          onClick={() => navigateWithAnimation('/dashboard', 'slide-left')}
          className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Home className="h-5 w-5 text-[#1a5276]" />
          <span className="text-xs text-[#1a5276] font-medium">Accounts</span>
        </button>
        <button 
          onClick={() => navigateWithAnimation('/payments', 'slide-right')}
          className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowRightLeft className="h-5 w-5 text-gray-500" />
          <span className="text-xs text-gray-500">Payments</span>
        </button>
        <button 
          onClick={() => navigateWithAnimation('/cards', 'slide-right')}
          className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <CreditCard className="h-5 w-5 text-gray-500" />
          <span className="text-xs text-gray-500">Cards</span>
        </button>
        <button 
          onClick={() => navigateWithAnimation('/more', 'slide-right')}
          className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Landmark className="h-5 w-5 text-gray-500" />
          <span className="text-xs text-gray-500">Services</span>
        </button>
        <button 
          onClick={() => navigateWithAnimation('/apply', 'slide-right')}
          className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <FileText className="h-5 w-5 text-gray-500" />
          <span className="text-xs text-gray-500">Apply</span>
        </button>
      </div>

      {/* BIC/IBAN or Sort Code Modal */}
      <AnimatePresence>
        {showAccountDetailsModal && (
          <div 
            onClick={() => setShowAccountDetailsModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ 
              zIndex: 1000,
              backgroundColor: 'rgba(0, 0, 0, 0.45)'
            }}
          >
            <motion.div 
              onClick={(e) => e.stopPropagation()}
              className="mx-4 overflow-hidden"
              style={{
                width: '85%',
                maxWidth: '340px',
                backgroundColor: '#ffffff',
                borderRadius: '4px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div 
                className="flex items-center justify-between"
                style={{ 
                  backgroundColor: '#126987',
                  padding: '14px 16px'
                }}
              >
                <span style={{ 
                  color: '#ffffff', 
                  fontSize: '16px', 
                  fontWeight: 500,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                  {userCurrency === 'GBP' ? 'Sort Code and Account Number' : 'BIC and IBAN'}
                </span>
                <button 
                  onClick={() => setShowAccountDetailsModal(false)}
                  className="flex items-center justify-center"
                  style={{ 
                    color: '#ffffff',
                    padding: '4px'
                  }}
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: '20px 20px 24px 20px' }}>
                {userCurrency === 'GBP' ? (
                  <>
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ 
                        fontSize: '14px', 
                        color: '#126987', 
                        fontWeight: 500, 
                        marginBottom: '6px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        Sort Code
                      </p>
                      <p style={{ 
                        fontSize: '17px', 
                        color: '#333333', 
                        fontWeight: 400,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        {customBankDisplayByAccount[accountId]?.sortCode || accountInfo?.sortCode || '90-38-16'}
                      </p>
                    </div>
                    <div style={{ marginBottom: '28px' }}>
                      <p style={{ 
                        fontSize: '14px', 
                        color: '#126987', 
                        fontWeight: 500, 
                        marginBottom: '6px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        Account Number
                      </p>
                      <p style={{ 
                        fontSize: '17px', 
                        color: '#333333', 
                        fontWeight: 400,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        {customBankDisplayByAccount[accountId]?.accountNumber || accountInfo?.accountNumber || '20163704'}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ 
                        fontSize: '14px', 
                        color: '#126987', 
                        fontWeight: 500, 
                        marginBottom: '6px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        BIC
                      </p>
                      <p style={{ 
                        fontSize: '17px', 
                        color: '#333333', 
                        fontWeight: 400,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        {customBankDisplayByAccount[accountId]?.bic || accountInfo?.bic || 'BOFIIE2DXXX'}
                      </p>
                    </div>
                    <div style={{ marginBottom: '28px' }}>
                      <p style={{ 
                        fontSize: '14px', 
                        color: '#126987', 
                        fontWeight: 500, 
                        marginBottom: '6px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        IBAN
                      </p>
                      <p style={{ 
                        fontSize: '17px', 
                        color: '#333333', 
                        fontWeight: 400,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        {customBankDisplayByAccount[accountId]?.iban || accountInfo?.iban || 'IE40BOFI 903816 20163704'}
                      </p>
                    </div>
                  </>
                )}

                {/* Share Button */}
                <button
                  onClick={async () => {
                    const customDisplay = customBankDisplayByAccount[accountId] || {};
                    const sortCode = customDisplay.sortCode || accountInfo?.sortCode || '90-38-16';
                    const accountNumber = customDisplay.accountNumber || accountInfo?.accountNumber || '20163704';
                    const bic = customDisplay.bic || accountInfo?.bic || 'BOFIIE2DXXX';
                    const iban = customDisplay.iban || accountInfo?.iban || 'IE40BOFI 903816 20163704';
                    
                    const shareText = userCurrency === 'GBP' 
                      ? `Hi\n\nMy Account details are:\n\nSort Code: ${sortCode}\nAccount Number: ${accountNumber}\n\nThanks`
                      : `Hi\n\nMy Account details are:\n\nBIC: ${bic}\nIBAN: ${iban}\n\nThanks`;
                    
                    if (navigator.share) {
                      try {
                        await navigator.share({ text: shareText });
                      } catch (err: any) {
                        if (err.name !== 'AbortError') {
                          try {
                            await navigator.clipboard.writeText(shareText);
                          } catch (clipErr) {
                            console.log('Share cancelled or clipboard unavailable');
                          }
                        }
                      }
                    } else {
                      try {
                        await navigator.clipboard.writeText(shareText);
                      } catch (clipErr) {
                        console.log('Clipboard unavailable');
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    fontSize: '16px',
                    fontWeight: 500,
                    backgroundColor: '#126987',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0',
                    cursor: 'pointer',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  Share
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTransaction && (
          <div 
            onClick={() => setSelectedTransaction(null)}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
            style={{ zIndex: 1000 }}>
            <motion.div 
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-2xl w-full h-[90vh] flex flex-col pb-safe"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                Transaction Details
              </h2>
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              >
                <span className="text-gray-600 text-lg">×</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              <div className="p-6 pt-4 pb-24">
                <div className="space-y-6">
              <div className="flex items-center justify-center py-4 bg-green-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-900">
                      Transaction Complete
                    </p>
                    <p className="text-sm text-green-700">
                      Successfully processed
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center py-4 border-b border-gray-200">
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(selectedTransaction.amount.replace('-', ''), userCurrency)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedTransaction.type === 'debit' ? 'Sent' : 'Received'}
                </p>
              </div>

              <div className="space-y-4">
                {/* Email Transfer has special ordering: Recipient → Email → Transfer Type → Transaction ID → Date */}
                {selectedTransaction.paymentMethod === 'EMAIL Transfer' ? (
                  <>
                    {selectedTransaction.recipientName && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Recipient:</span>
                        <span className="font-semibold text-gray-900">
                          {selectedTransaction.recipientName}
                        </span>
                      </div>
                    )}

                    {selectedTransaction.recipientEmail && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Recipient Email:</span>
                        <span className="font-semibold text-gray-900 text-sm">
                          {selectedTransaction.recipientEmail}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-600">Transfer Type:</span>
                      <div className="flex items-center space-x-2">
                        <Globe className="w-4 h-4 text-[#126987]" />
                        <span className="font-semibold text-gray-900">
                          {selectedTransaction.paymentMethod}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Transaction ID:</span>
                      <span className="font-mono text-sm text-gray-900">
                        {String(selectedTransaction.id).padStart(14, '0')}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Date & Time:</span>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {new Date(selectedTransaction.timestamp).toLocaleDateString('en-IE', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(selectedTransaction.timestamp).toLocaleTimeString('en-IE', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Description:</span>
                      <span className="font-semibold text-gray-900 text-right">
                        {selectedTransaction.description}
                      </span>
                    </div>

                    {selectedTransaction.paymentMethod && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          {selectedTransaction.paymentMethod === 'Manual Entry' ? 'Payment Method:' : 'Transfer Type:'}
                        </span>
                        <div className="flex items-center space-x-2">
                          {selectedTransaction.paymentMethod === 'UK Transfer' ? (
                            <MapPin className="w-4 h-4 text-[#126987]" />
                          ) : (
                            <Globe className="w-4 h-4 text-[#126987]" />
                          )}
                          <span className="font-semibold text-gray-900">
                            {selectedTransaction.paymentMethod === 'Manual Entry' ? 'Direct Transaction' : selectedTransaction.paymentMethod}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-600">Date & Time:</span>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {new Date(selectedTransaction.timestamp).toLocaleDateString('en-IE', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(selectedTransaction.timestamp).toLocaleTimeString('en-IE', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Transaction ID:</span>
                      <span className="font-mono text-sm text-gray-900">
                        {String(selectedTransaction.id).padStart(14, '0')}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-semibold text-gray-900 capitalize">
                        {selectedTransaction.category}
                      </span>
                    </div>
                  </>
                )}

                {(selectedTransaction.paymentMethod === 'UK Transfer' || selectedTransaction.paymentMethod === 'IBAN Transfer' || selectedTransaction.iban || selectedTransaction.recipientAccountNumber) && (
                  <>
                    {selectedTransaction.recipientName && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Recipient:</span>
                        <span className="font-semibold text-gray-900">
                          {selectedTransaction.recipientName}
                        </span>
                      </div>
                    )}

                    {selectedTransaction.iban && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">IBAN:</span>
                        <span className="font-semibold text-gray-900 font-mono text-sm">
                          {selectedTransaction.iban}
                        </span>
                      </div>
                    )}

                    {selectedTransaction.bicCode && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">BIC Code:</span>
                        <span className="font-semibold text-gray-900">
                          {selectedTransaction.bicCode}
                        </span>
                      </div>
                    )}

                    {selectedTransaction.paymentMethod === 'SEPA Transfer' && selectedTransaction.reference && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Reference:</span>
                        <span className="font-semibold text-gray-900">
                          {selectedTransaction.reference}
                        </span>
                      </div>
                    )}

                    {selectedTransaction.paymentMethod === 'UK Transfer' && selectedTransaction.recipientSortCode && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Sort Code:</span>
                        <span className="font-semibold text-gray-900">
                          {selectedTransaction.recipientSortCode.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3')}
                        </span>
                      </div>
                    )}
                    
                    {selectedTransaction.paymentMethod === 'UK Transfer' && selectedTransaction.recipientAccountNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Account Number:</span>
                        <span className="font-semibold text-gray-900">
                          {selectedTransaction.recipientAccountNumber}
                        </span>
                      </div>
                    )}

                    {selectedTransaction.paymentMethod === 'UK Transfer' && selectedTransaction.reference && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Reference:</span>
                        <span className="font-semibold text-gray-900">
                          {selectedTransaction.reference}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {selectedTransaction.paymentMethod === 'UK Transfer' && selectedTransaction.exchangeRate && userCurrency === 'EUR' && (
                  <>
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Currency Conversion
                      </h4>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Exchange Rate:</span>
                      <span className="font-semibold text-gray-900">
                        €1 = £{selectedTransaction.exchangeRate.toFixed(4)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">GBP Equivalent:</span>
                      <div className="text-right">
                        <span className="font-semibold text-green-700">
                          £{selectedTransaction.convertedAmount}
                        </span>
                        <p className="text-xs text-gray-500">
                          Live rate at time of transfer
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {selectedTransaction.paymentMethod === 'UK Transfer' && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        {userCurrency === 'EUR' 
                          ? <><strong>International Transfer:</strong> UK transfers typically take 24 hours to reach the recipient.</>
                          : <>UK transfers typically take 24 hours to reach the recipient.</>}
                      </p>
                    </div>

                    <div className="bg-red-50 border border-red-300 rounded-lg p-3 mt-3">
                      <p className="text-sm text-red-700">
                        This payment cannot be cancelled
                      </p>
                    </div>
                  </div>
                )}

                {selectedTransaction.paymentMethod === 'SEPA Transfer' && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        <strong>SEPA Transfer:</strong> Transfers within the SEPA zone typically take 24 hours to complete.
                      </p>
                    </div>

                    <div className="bg-red-50 border border-red-300 rounded-lg p-3 mt-3">
                      <p className="text-sm text-red-700">
                        This payment cannot be cancelled
                      </p>
                    </div>
                  </div>
                )}

                {selectedTransaction.paymentMethod === 'EMAIL Transfer' && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        <strong>Email Transfer:</strong> Recipient will receive payment notification at their email address.
                      </p>
                    </div>

                    <div className="bg-red-50 border border-red-300 rounded-lg p-3 mt-3">
                      <p className="text-sm text-red-700">
                        This payment cannot be cancelled
                      </p>
                    </div>
                  </div>
                )}

                {selectedTransaction.paymentMethod && 
                 !selectedTransaction.isSample &&
                 (selectedTransaction.paymentMethod === 'UK Transfer' || 
                  selectedTransaction.paymentMethod === 'IBAN Transfer' || 
                  selectedTransaction.paymentMethod === 'SEPA Transfer' ||
                  selectedTransaction.paymentMethod === 'EMAIL Transfer') &&
                 showTransferConfirmation && (
                  <div className="border-t border-gray-200 pt-6 mt-6">
                    <button
                      onClick={handleOpenTransferConfirmation}
                      className="w-full px-4 py-3 bg-[#126987] text-white rounded-lg font-medium hover:bg-[#3a5963] transition-colors flex items-center justify-center space-x-2"
                      data-testid="button-open-transfer-confirmation"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>View Transfer Document</span>
                    </button>
                  </div>
                )}
              </div>
                </div>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pay Bills Modal */}
      {showPayBillsForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
             style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Pay Bills</h2>
              <button
                onClick={() => setShowPayBillsForm(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handlePayBillsSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payee
                </label>
                <input
                  type="text"
                  value={payBillsForm.payee}
                  onChange={(e) => setPayBillsForm(prev => ({ ...prev, payee: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#126987] focus:border-transparent"
                  placeholder="Enter payee name (e.g., Electric Ireland)"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={parseFloat(balance)}
                  value={payBillsForm.amount}
                  onChange={(e) => setPayBillsForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#126987] focus:border-transparent"
                  placeholder="0.00"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available balance: €{balance}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={payBillsForm.datetime}
                  onChange={(e) => setPayBillsForm(prev => ({ ...prev, datetime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#126987] focus:border-transparent"
                  required
                />
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPayBillsForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#126987] text-white rounded-lg font-medium hover:bg-[#3a5963] transition-colors"
                >
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Statement Modal */}
      <AnimatePresence>
        {showStatementModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
               style={{ zIndex: 9999 }}>
            <motion.div 
              className="bg-white rounded-t-2xl w-full h-[75vh] flex flex-col pb-safe"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                Generate Statement
              </h2>
              <button
                onClick={handleCloseStatementSuccess}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                data-testid="button-close-statement-modal"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {!statementSuccessState ? (
                <>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Account</p>
                    <p className="font-semibold text-gray-900">
                      {accountInfo?.displayName || 'Current Account'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={statementDateRange.from}
                      onChange={(e) => {
                        setStatementDateRange(prev => ({ ...prev, from: e.target.value }));
                        setStatementError('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#126987] focus:border-transparent"
                      data-testid="input-statement-from-date"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={statementDateRange.to}
                      onChange={(e) => {
                        setStatementDateRange(prev => ({ ...prev, to: e.target.value }));
                        setStatementError('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#126987] focus:border-transparent"
                      data-testid="input-statement-to-date"
                    />
                  </div>

                  {statementError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-800">
                        {statementError}
                      </p>
                    </div>
                  )}

                  <div className="flex space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowStatementModal(false);
                        setStatementError('');
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                      disabled={isGeneratingStatement}
                      data-testid="button-cancel-statement"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateStatement}
                      className="flex-1 px-4 py-2 bg-[#126987] text-white rounded-lg font-medium hover:bg-[#3a5963] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      disabled={isGeneratingStatement}
                      data-testid="button-generate-statement"
                    >
                      {isGeneratingStatement ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        'Generate'
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center py-4">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Statement Generated Successfully
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Your statement for {accountInfo?.displayName || 'account'} is ready
                    </p>

                    <div className="space-y-3">
                      <button
                        onClick={handleOpenStatement}
                        className="w-full px-4 py-3 bg-[#126987] text-white rounded-lg font-medium hover:bg-[#3a5963] transition-colors flex items-center justify-center space-x-2"
                        data-testid="button-open-statement"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Open</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Popup Blocked Modal */}
      {showPopupBlockedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
             style={{ zIndex: 9999 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl"
          >
            <div className="p-6">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Allow Access
                </h3>
                <p className="text-sm text-gray-600 mb-6" style={{ fontFamily: 'OpenSans, sans-serif' }}>
                  Tap "Allow" to view the transfer confirmation, or "Download" to save the PDF.
                </p>

                <div className="space-y-3">
                  <button
                    onClick={handleAllowPopup}
                    className="w-full px-4 py-3 bg-[#126987] text-white rounded-lg font-medium hover:bg-[#3a5963] transition-colors flex items-center justify-center space-x-2"
                    data-testid="button-allow-popup"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span style={{ fontFamily: 'OpenSans, sans-serif' }}>Allow</span>
                  </button>
                  <button
                    onClick={handleDownloadConfirmation}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                    data-testid="button-download-confirmation"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span style={{ fontFamily: 'OpenSans, sans-serif' }}>Download</span>
                  </button>
                  <button
                    onClick={handleClosePopupModal}
                    className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    data-testid="button-cancel-popup"
                  >
                    <span style={{ fontFamily: 'OpenSans, sans-serif' }}>Cancel</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
