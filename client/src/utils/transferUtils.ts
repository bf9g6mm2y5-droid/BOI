// Transfer utilities
import { UserDataManager } from './userDataManager';
import { sendTransferNotification } from './notifications';
import { getAppDate } from './appTime';

export interface Account {
  id: string;
  name: string;
  number: string;
  balance: string;
}

export interface Transaction {
  id: number;
  accountId: number;
  amount: string;
  description: string;
  category: string;
  type: 'debit' | 'credit';
  paymentMethod: string;
  reference?: string;
  recipientName?: string;
  iban?: string;
  bicCode?: string;
  recipientAccountNumber?: string;
  recipientSortCode?: string;
  recipientIban?: string;
  exchangeRate?: number;
  convertedAmount?: string;
  convertedCurrency?: string;
  timestamp: string;
  confirmationPdfData?: string;
}

export const getAccounts = (): Account[] => {
  // Clear cache to ensure we get the most recent data
  UserDataManager.clearCache('bankAccounts');
  
  // Get current balances using UserDataManager
  const storedAccounts = UserDataManager.getUserData('bankAccounts', []);
  const defaultAccounts = [
    { id: 1, displayName: "Current Account", accountNumber: "****2091", balance: "0.00", accountType: "current", sortCode: "90-78-68" },
    { id: 2, displayName: "Credit Card", accountNumber: "****1820", balance: "0.00", accountType: "credit", sortCode: "90-78-68" },
    { id: 3, displayName: "Savings Account", accountNumber: "****0978", balance: "0.00", accountType: "savings", sortCode: "90-78-68" }
  ];
  
  // Ensure we have valid account data
  const accounts = (Array.isArray(storedAccounts) && storedAccounts.length > 0) ? storedAccounts : defaultAccounts;
  
  // Get user currency for proper display
  const userCurrency = localStorage.getItem('userCurrency') || 'EUR';
  const currencySymbol = userCurrency === 'GBP' ? '£' : '€';
  
  return accounts.map((acc: any) => ({
    id: acc.id.toString(),
    name: acc.displayName,
    number: acc.accountNumber.replace('****', '-'),
    balance: `${currencySymbol}${parseFloat(acc.balance || '0.00').toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }));
};

export const processSecureTransfer = async (
  fromAccountId: string,
  amount: number,
  recipientName: string,
  transferType: 'UK' | 'IBAN' | 'EMAIL',
  reference: string,
  exchangeRate?: number,
  recipientDetails?: { accountNumber?: string; sortCode?: string; iban?: string; email?: string }
): Promise<{ success: boolean; transferId?: string; error?: string; requiresConfirmation?: boolean }> => {
  console.log('Initiating secure transfer:', { fromAccountId, amount, recipientName, transferType, reference });

  // Get user phone number for security call
  const userProfile = UserDataManager.getUserProfile();
  if (!userProfile?.phone) {
    return { success: false, error: 'Phone number required for security verification' };
  }

  // Generate unique transfer ID
  const transferId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

  try {
    // Initiate security call
    const securityResponse = await fetch('/api/security/initiate-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount.toFixed(2),
        recipientName,
        userPhoneNumber: userProfile.phone,
        transferId,
        transferType
      })
    });

    const securityResult = await securityResponse.json();
    
    if (!securityResult.success) {
      return { success: false, error: securityResult.error || 'Security verification failed' };
    }

    console.log(`Security call initiated for transfer ${transferId}`);
    
    // Return pending status - actual transfer will be processed after voice confirmation
    return { 
      success: true, 
      transferId, 
      requiresConfirmation: true 
    };

  } catch (error) {
    console.error('Failed to initiate secure transfer:', error);
    return { success: false, error: 'Failed to initiate security verification' };
  }
};

const PENDING_BALANCE_SYNCS_KEY = 'pendingBalanceSyncs';

interface PendingBalanceSync {
  accountId: string;
  balance: string;
  timestamp: number;
}

export const syncBalanceToServer = (accountId: string, balance: string): void => {
  const doSync = () =>
    fetch(`/api/accounts/${accountId}/balance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ balance }),
    });

  doSync()
    .then(res => {
      if (res.ok) {
        console.log('💰 Balance synced to server for account', accountId);
        const pending: PendingBalanceSync[] = JSON.parse(localStorage.getItem(PENDING_BALANCE_SYNCS_KEY) || '[]');
        const remaining = pending.filter(p => p.accountId !== accountId);
        localStorage.setItem(PENDING_BALANCE_SYNCS_KEY, JSON.stringify(remaining));
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    })
    .catch(() => {
      console.warn('⚠️ Balance sync failed - queuing for when online');
      const pending: PendingBalanceSync[] = JSON.parse(localStorage.getItem(PENDING_BALANCE_SYNCS_KEY) || '[]');
      const withoutThis = pending.filter(p => p.accountId !== accountId);
      withoutThis.push({ accountId, balance, timestamp: Date.now() });
      localStorage.setItem(PENDING_BALANCE_SYNCS_KEY, JSON.stringify(withoutThis));
    });
};

export const flushPendingBalanceSyncs = (): void => {
  const pending: PendingBalanceSync[] = JSON.parse(localStorage.getItem(PENDING_BALANCE_SYNCS_KEY) || '[]');
  if (pending.length === 0) return;
  console.log(`🔄 Flushing ${pending.length} pending balance sync(s)...`);
  pending.forEach(({ accountId, balance }) => syncBalanceToServer(accountId, balance));
};

export const getPendingBalanceSyncs = (): Record<string, string> => {
  const pending: PendingBalanceSync[] = JSON.parse(localStorage.getItem(PENDING_BALANCE_SYNCS_KEY) || '[]');
  const map: Record<string, string> = {};
  pending.forEach(p => { map[String(p.accountId)] = p.balance; });
  return map;
};

const PENDING_TRANSACTION_SYNCS_KEY = 'pendingTransactionSyncs';

interface PendingTransactionSync {
  accountId: number;
  transaction: Transaction;
}

// Persists a transfer's transaction record (recipient, reference, etc.) to the
// server so it survives a device switch or a cleared browser - previously only
// the resulting balance was synced via syncBalanceToServer, so the balance was
// correct on another device but its transaction history was missing entirely.
// skipBalanceUpdate is always sent here since syncBalanceToServer already pushes
// the authoritative new balance separately - applying this transaction's amount
// again server-side would double-count it.
export const syncTransactionToServer = (accountId: number, transaction: Transaction): void => {
  const doSync = () =>
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        accountId,
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category,
        type: transaction.type,
        paymentMethod: transaction.paymentMethod,
        reference: transaction.reference,
        recipientName: transaction.recipientName,
        iban: transaction.iban,
        bicCode: transaction.bicCode,
        recipientAccountNumber: transaction.recipientAccountNumber,
        recipientSortCode: transaction.recipientSortCode,
        recipientIban: transaction.recipientIban,
        exchangeRate: transaction.exchangeRate,
        convertedAmount: transaction.convertedAmount,
        convertedCurrency: transaction.convertedCurrency,
        timestamp: transaction.timestamp,
        skipBalanceUpdate: true,
      }),
    });

  const removeFromQueue = () => {
    const pending: PendingTransactionSync[] = JSON.parse(localStorage.getItem(PENDING_TRANSACTION_SYNCS_KEY) || '[]');
    const remaining = pending.filter(p => p.transaction.id !== transaction.id);
    localStorage.setItem(PENDING_TRANSACTION_SYNCS_KEY, JSON.stringify(remaining));
  };

  const queueForRetry = () => {
    const pending: PendingTransactionSync[] = JSON.parse(localStorage.getItem(PENDING_TRANSACTION_SYNCS_KEY) || '[]');
    if (pending.some(p => p.transaction.id === transaction.id)) return;
    pending.push({ accountId, transaction });
    localStorage.setItem(PENDING_TRANSACTION_SYNCS_KEY, JSON.stringify(pending));
  };

  doSync()
    .then(res => {
      if (res.ok) {
        console.log('📝 Transaction synced to server', transaction.id);
        removeFromQueue();
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    })
    .catch(() => {
      console.warn('⚠️ Transaction sync failed - queuing for when online');
      queueForRetry();
    });
};

export const flushPendingTransactionSyncs = (): void => {
  const pending: PendingTransactionSync[] = JSON.parse(localStorage.getItem(PENDING_TRANSACTION_SYNCS_KEY) || '[]');
  if (pending.length === 0) return;
  console.log(`🔄 Flushing ${pending.length} pending transaction sync(s)...`);
  pending.forEach(({ accountId, transaction }) => syncTransactionToServer(accountId, transaction));
};

export const processTransfer = (
  fromAccountId: string,
  amount: number,
  recipientName: string,
  transferType: 'UK' | 'IBAN' | 'EMAIL',
  reference: string,
  exchangeRate?: number,
  recipientDetails?: { accountNumber?: string; sortCode?: string; iban?: string; bicCode?: string; email?: string },
  recipientEmail?: string
): boolean => {
  console.log('Processing transfer:', { fromAccountId, amount, recipientName, transferType, reference, recipientEmail });
  
  // Get stored accounts using UserDataManager
  const accounts = UserDataManager.getUserData('bankAccounts', []);
  
  console.log('Found accounts:', accounts);
  
  // Ensure accounts is an array and not null
  if (!Array.isArray(accounts) || accounts.length === 0) {
    console.error('No accounts available for transfer');
    return false;
  }
  
  const selectedAccount = accounts.find((acc: any) => acc && acc.id && acc.id.toString() === fromAccountId);
  console.log('Selected account:', selectedAccount);
  
  if (!selectedAccount) {
    console.error('Account not found');
    return false;
  }
  
  const currentBalance = parseFloat(selectedAccount.balance);
  console.log('Current balance:', currentBalance, 'Transfer amount:', amount);
  
  if (amount > currentBalance) {
    console.error('Insufficient funds');
    console.error('Transfer failed');
    return false;
  }

  // Update balance in the account locally for immediate UI feedback
  const newBalance = (currentBalance - amount).toFixed(2);
  selectedAccount.balance = newBalance;
  console.log('New balance:', newBalance);
  
  // Update the accounts array
  const updatedAccounts = accounts.map((acc: any) => 
    acc.id.toString() === fromAccountId ? selectedAccount : acc
  );
  
  // Store updated accounts using UserDataManager
  UserDataManager.setUserData('bankAccounts', updatedAccounts);
  console.log('Updated accounts stored');
  
  // Store transaction using UserDataManager
  const transactions = UserDataManager.getUserData('bankTransactions', []);
  const newTransaction: Transaction = {
    id: Date.now(),
    accountId: parseInt(fromAccountId),
    amount: `-${amount.toFixed(2)}`,
    description: `${transferType === 'IBAN' ? 'SEPA' : transferType} Transfer to ${recipientName}`,
    category: 'transfer',
    type: 'debit',
    paymentMethod: `${transferType === 'IBAN' ? 'SEPA' : transferType} Transfer`,
    reference,
    recipientName,
    timestamp: getAppDate().toISOString(),
    ...(transferType === 'UK' && exchangeRate && {
      exchangeRate,
      convertedAmount: (amount * exchangeRate).toFixed(2),
      convertedCurrency: 'GBP'
    }),
    ...(recipientDetails && {
      recipientAccountNumber: recipientDetails.accountNumber,
      recipientSortCode: recipientDetails.sortCode,
      iban: recipientDetails.iban,
      bicCode: recipientDetails.bicCode,
      recipientIban: recipientDetails.iban,
      recipientEmail: recipientDetails.email
    }),
    ...(recipientEmail && { recipientEmail })
  };
  
  transactions.push(newTransaction);
  UserDataManager.setUserData('bankTransactions', transactions);
  
  // Generate and store PDF confirmation immediately after transfer
  setTimeout(async () => {
    try {
      const userProfile = UserDataManager.getUserProfile();
      const accountInfo = updatedAccounts.find((acc: any) => acc.id.toString() === fromAccountId);
      
      const response = await fetch('/api/generate-transfer-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: newTransaction,
          senderName: userProfile?.name || 'Customer',
          accountInfo: accountInfo?.displayName || 'Account',
          userCurrency: userProfile?.currency || 'EUR'
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          // Store PDF as base64 with the transaction
          const base64data = reader.result as string;
          newTransaction.confirmationPdfData = base64data;
          const allTransactions = UserDataManager.getUserData('bankTransactions', []);
          const updatedTransactions = allTransactions.map((t: Transaction) => 
            t.id === newTransaction.id ? { ...t, confirmationPdfData: base64data } : t
          );
          UserDataManager.setUserData('bankTransactions', updatedTransactions);
          console.log('PDF confirmation saved with transaction');
        };
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error('Failed to generate PDF confirmation:', error);
    }
  }, 100);
  console.log('Transaction stored:', newTransaction);
  
  // Dispatch balance update event
  window.dispatchEvent(new CustomEvent('balanceUpdate', {
    detail: { accountId: parseInt(fromAccountId), newBalance }
  }));
  
  // Dispatch transaction added event
  window.dispatchEvent(new CustomEvent('transactionAdded', {
    detail: { accountId: parseInt(fromAccountId), transaction: newTransaction }
  }));
  
  console.log('Balance update and transaction events dispatched');
  
  // Update balance in database (background) - queue if offline
  syncBalanceToServer(fromAccountId, newBalance);

  // Persist the transaction record itself (background) - queue if offline
  syncTransactionToServer(parseInt(fromAccountId), newTransaction);

  // ✅ TRANSFER COMPLETED SUCCESSFULLY - NOW SEND EMAIL CONFIRMATION
  console.log('🔵 TRANSFER COMPLETED - Starting email confirmation process');
  try {
    // Try multiple sources for user data
    let userProfile = UserDataManager.getUserData('userProfile', null);
    
    // If userProfile is null, try getting from auth system
    if (!userProfile) {
      const bankingUser = localStorage.getItem('bankingUser');
      if (bankingUser) {
        try {
          userProfile = JSON.parse(bankingUser);
          console.log('User profile found in auth system:', userProfile ? 'YES' : 'NO');
        } catch (e) {
          console.log('Failed to parse banking user data');
        }
      }
    }
    
    // If still no profile, try UserDataManager's getUserProfile method
    if (!userProfile) {
      userProfile = UserDataManager.getUserProfile();
    }
    
    // Get currency from bankUsers location (where it's actually saved)
    let userCurrency = 'EUR'; // default
    try {
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        const allUsers = JSON.parse(localStorage.getItem('bankUsers') || '{}');
        if (allUsers[currentUser] && allUsers[currentUser].currency) {
          userCurrency = allUsers[currentUser].currency;
          console.log('User currency from bankUsers:', userCurrency);
        }
      }
    } catch (e) {
      console.log('Failed to get currency from bankUsers, using default EUR');
    }
    
    console.log('User profile found:', userProfile ? 'YES' : 'NO');
    console.log('User email:', userProfile?.email);
    
    if (userProfile && userProfile.email) {
      const timestamp = getAppDate().toLocaleString('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Dublin'
      });
      
      const transactionReference = newTransaction.reference || `BOI${Date.now()}`;
      const currency = userCurrency === 'GBP' ? '£' : '€';
      
      // Use exact format specified by user
      const emailBody = `Hello ${userProfile.name},

Your transfer of ${currency} ${amount.toFixed(2)} to ${recipientName} has been completed successfully.

Reference: ${transactionReference}
Date: ${timestamp}

Thank you for using our service.`;

      // Check if emails are enabled
      const emailsEnabled = localStorage.getItem('emailsEnabled');
      const sendEmail = emailsEnabled !== null ? JSON.parse(emailsEnabled) : true;

      const emailRequest = {
        userEmail: userProfile.email,
        senderName: userProfile.name,
        recipientName: recipientName,
        amount: amount.toFixed(2),
        currency: currency,
        transactionReference: transactionReference,
        accountInfo: `${selectedAccount.displayName} (${selectedAccount.accountNumber})`,
        transferData: newTransaction,
        userCurrency: userCurrency,
        emailsEnabled: sendEmail,
        recipientEmail: recipientEmail
      };

      // Send email confirmation after successful transfer (if enabled)
      console.log('🔵 Making email API request to:', '/api/send-transfer-email');
      console.log('🔵 Email request payload:', emailRequest);
      console.log('📧 Emails enabled:', sendEmail);
      
      fetch('/api/send-transfer-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(emailRequest)
      }).then(response => {
        console.log('🔵 Email API response status:', response.status);
        if (response.ok) {
          console.log('✅ Transfer confirmation email sent successfully to:', userProfile.email);
          return response.json();
        } else {
          console.error('❌ Failed to send transfer confirmation email. Status:', response.status);
          return response.text().then(text => {
            console.error('Error response:', text);
          });
        }
      }).catch(error => {
        console.error('🔴 Email confirmation request failed:', error);
      });
    } else {
      console.warn('⚠️ No user email found - transfer confirmation email not sent');
    }
  } catch (emailError) {
    console.error('❌ Error sending transfer confirmation email:', emailError);
  }
  
  // Send push notification for completed transfer (5-second delay) - only if enabled
  const notificationsEnabled = localStorage.getItem('notificationsEnabled');
  const sendNotification = notificationsEnabled !== null ? JSON.parse(notificationsEnabled) : true;
  
  if (sendNotification) {
    sendTransferNotification(recipientName, amount.toFixed(2));
  } else {
    console.log('🔕 Notifications disabled - skipping transfer notification');
  }
  
  return true;
};

export const checkTransferConfirmation = async (transferId: string): Promise<{ confirmed: boolean; status: any }> => {
  try {
    const response = await fetch(`/api/security/status/${transferId}`);
    const result = await response.json();
    return { confirmed: result.confirmed, status: result.status };
  } catch (error) {
    console.error('Failed to check transfer confirmation:', error);
    return { confirmed: false, status: null };
  }
};

export const processConfirmedTransfer = async (
  transferId: string,
  fromAccountId: string,
  amount: number,
  recipientName: string,
  transferType: 'UK' | 'IBAN' | 'EMAIL',
  reference: string,
  exchangeRate?: number,
  recipientDetails?: { accountNumber?: string; sortCode?: string; iban?: string; bicCode?: string; email?: string },
  recipientEmail?: string
): Promise<boolean> => {
  console.log('Processing confirmed transfer:', { transferId, fromAccountId, amount, recipientName, transferType, reference, recipientEmail });
  
  // Execute the transfer logic
  const success = processTransfer(fromAccountId, amount, recipientName, transferType, reference, exchangeRate, recipientDetails, recipientEmail);
  
  if (success) {
    console.log(`Transfer ${transferId} completed successfully`);
  } else {
    console.error(`Transfer ${transferId} failed during processing`);
  }
  
  return success;
};

export const generateReference = (): string => {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substr(2, 5).toUpperCase();
  const uniqueId = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `BOI${timestamp.toString().slice(-8)}${randomPart}${uniqueId}`;
};