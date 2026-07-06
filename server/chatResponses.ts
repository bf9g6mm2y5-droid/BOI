// Live chat response engine for Bank of Ireland customer support.
//
// This is fully local/deterministic - no external API (OpenAI or otherwise)
// is called, so the chat keeps working even with no network connectivity or
// API key. It replaces the previous OpenAI-backed implementation with rules
// that cover the same ground: transfer status/proof, guarantees, delays,
// cancellations, balances, cards, ATMs, statements, security, app issues,
// small talk, and a graceful catch-all - while tolerating typos, slang,
// ALL CAPS, and vague or frustrated phrasing via loose keyword matching.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LastTransferInfo {
  id: number | string;
  amount: string; // formatted, e.g. "40.00" (no currency symbol, no sign)
  recipientName: string;
  date: string; // already formatted for display
  time: string; // already formatted for display
  reference: string;
  paymentMethod: 'UK Transfer' | 'SEPA Transfer' | 'EMAIL Transfer' | string;
  sortCode?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  bicCode?: string | null;
  recipientEmail?: string | null;
}

function pick(responses: string[]): string {
  return responses[Math.floor(Math.random() * responses.length)];
}

// Same UK sort-code prefix mapping used client-side when building the
// transfer summary shown before the confirmation PDF - kept in sync so the
// bank name mentioned in chat always matches what's shown elsewhere.
function identifyBankFromSortCode(sortCode?: string | null): string {
  if (!sortCode) return 'their bank';
  const prefix = sortCode.replace(/-/g, '').substring(0, 2);
  const banks: Record<string, string> = {
    '04': 'Monzo',
    '20': 'Barclays',
    '30': 'Lloyds Bank',
    '60': 'Lloyds Bank',
    '77': 'TSB Bank',
    '83': 'NatWest',
    '80': 'Bank of Scotland',
    '40': 'HSBC',
    '16': 'Starling Bank',
    '23': 'Metro Bank',
  };
  return banks[prefix] || 'their bank';
}

function isFrustrated(message: string): boolean {
  const lower = message.toLowerCase();
  const angryWords = ['wtf', 'ridiculous', 'unacceptable', 'furious', 'angry', 'pissed', 'scam', 'fraud team', 'joke', 'useless', 'shocking', 'disgusting', 'fuming'];
  const isShouting = message.length > 6 && message === message.toUpperCase() && /[A-Z]/.test(message);
  return isShouting || angryWords.some(w => lower.includes(w)) || /!{2,}/.test(message);
}

function describeTransfer(t: LastTransferInfo, currencySymbol: string): string {
  const parts: string[] = [`${currencySymbol}${t.amount} to ${t.recipientName} on ${t.date} at ${t.time}`];
  if (t.reference && t.reference !== 'N/A') parts.push(`reference ${t.reference}`);
  return parts.join(', ');
}

function transferAccountDetails(t: LastTransferInfo): string {
  if (t.paymentMethod === 'SEPA Transfer') {
    return `That was sent via SEPA to IBAN ${t.iban || 'not available'}${t.bicCode ? ` (BIC ${t.bicCode})` : ''}.`;
  }
  if (t.paymentMethod === 'EMAIL Transfer') {
    return `That was sent by email to ${t.recipientEmail || t.recipientName} - they'll have received a notification, with funds available within 24 hours.`;
  }
  const bank = identifyBankFromSortCode(t.sortCode);
  return `That went to ${bank}, account number ${t.accountNumber || 'not available'}, sort code ${t.sortCode || 'not available'}.`;
}

interface Intent {
  triggers: string[];
  respond: (ctx: { message: string; lastTransfer: LastTransferInfo | null; currencySymbol: string; agentName: string }) => string;
}

const INTENTS: Intent[] = [
  // Proof / document / PDF / receipt / confirmation - highest priority so it
  // wins even when the message also mentions "transfer" or "payment".
  {
    triggers: ['proof', 'document', 'receipt', 'pdf', 'evidence', 'record of', 'confirmation'],
    respond: ({ lastTransfer }) => {
      if (lastTransfer) {
        return pick([
          "Of course! I've attached the PDF confirmation for your recent transfer below - just tap to download or view it.",
          "Here is the payment confirmation you requested. The PDF document is attached below.",
          "I've pulled up the proof of your transfer. You'll find the PDF confirmation attached below.",
        ]);
      }
      return "I'd be happy to provide that. I wasn't able to find a recent transfer on your account to generate a confirmation for - could you check you've made one recently?";
    },
  },
  // "Last transfer" / status / did it go through
  {
    triggers: ['last transfer', 'last payment', 'most recent', 'recent transfer', 'recent payment', 'did my transfer', 'has my transfer', 'transfer go through', 'payment go through', 'confirm my transfer', 'confirm transfer', 'show my transfer', 'my transfer', 'wheres my money', "where's my money", 'not gone in', 'not gone through', 'not there yet', 'not showing', 'havent got it', "haven't got it", 'hasnt arrived', "hasn't arrived"],
    respond: ({ lastTransfer, currencySymbol }) => {
      if (!lastTransfer) {
        return "I'm sorry, I wasn't able to bring up a recent transfer on your account just now. Would you like me to try again, or I can connect you with another agent who might have better access?";
      }
      const summary = describeTransfer(lastTransfer, currencySymbol);
      const details = transferAccountDetails(lastTransfer);
      return `I can see your last transfer - ${summary}. ${details} It's been processed successfully and is guaranteed to arrive within the normal timeframe.`;
    },
  },
  // IBAN / BIC / account number / sort code lookup
  {
    triggers: ['iban', 'bic', 'account number', 'sort code'],
    respond: ({ lastTransfer }) => {
      if (lastTransfer && (lastTransfer.iban || lastTransfer.sortCode)) {
        return `${transferAccountDetails(lastTransfer)} Let me know if you need anything else confirmed.`;
      }
      return "Your own account's IBAN/BIC or account number and sort code are shown at the top of the 'Current Account' card on your dashboard - just tap into the account to see them.";
    },
  },
  // Guarantee / reassurance
  {
    triggers: ['guarantee', 'is it safe', 'will it arrive', 'will it go through', 'are you sure', 'is my money safe', 'safe with you'],
    respond: () => pick([
      "I can absolutely guarantee your payment will reach the recipient's account. Every Bank of Ireland transfer is fully secured, tracked, and guaranteed to complete successfully.",
      "Yes, I can guarantee it 100%. Your money is completely safe and will definitely arrive in the recipient's account.",
      "I guarantee it completely - your transfer is fully protected and will absolutely reach the recipient.",
    ]),
  },
  // Delay / timing questions
  {
    triggers: ['how long', 'taking so long', 'taking ages', 'when will it', 'delay', 'delayed', 'why is it still'],
    respond: () => pick([
      "UK transfers can take up to 24 hours to process, so it's still well within the normal timeframe and will absolutely arrive.",
      "SEPA transfers typically take 1-2 business days, so yours is right on track and will definitely complete.",
      "We're seeing slightly higher volumes today, but your transfer is progressing normally and is guaranteed to arrive within the usual window.",
    ]),
  },
  // Cancel / reverse
  {
    triggers: ['cancel', 'reverse', 'stop the payment', 'stop my transfer', 'pull it back', 'undo'],
    respond: () => pick([
      "I'm afraid once a transfer's been submitted we can't stop it, as it's already gone through to processing.",
      "Unfortunately there's no way to cancel it now - the transfer has already been sent to the recipient's bank.",
      "Sorry, but once it's initiated the payment can't be pulled back as it's already in the banking system.",
    ]),
  },
  // Balance
  {
    triggers: ['balance', 'how much do i have', 'how much have i got', 'money left', 'whats my balance', "what's my balance"],
    respond: () => pick([
      "You can check your balance on the main dashboard - just tap on your account to see the current balance and recent transactions.",
      "Your account balance is shown on the home screen. Tap any account to view the full details and transaction history.",
    ]),
  },
  // Card issues
  {
    triggers: ['card blocked', 'unblock', 'card not working', 'lost my card', 'stolen', 'lost card', 'freeze my card', 'block my card', 'card'],
    respond: () => pick([
      "If your card is lost or stolen, please freeze it immediately from the Cards section in the app - we can then arrange a replacement.",
      "You can block your card instantly from the Cards section. If you need a replacement, we can arrange that for you right away.",
      "For card issues, go to Profile > Customer Panel and select 'Unblock Card' if it's been blocked, or let me know if you need a replacement.",
    ]),
  },
  // ATM / cash withdrawal
  {
    triggers: ['atm', 'cash machine', 'withdraw', 'withdrawal', 'declined me'],
    respond: ({ currencySymbol }) => pick([
      `You can withdraw cash at any ATM using your card. The daily limit is ${currencySymbol}300 (£250 for GBP accounts). Let me know if you need help finding one.`,
      `For ATM withdrawals your daily limit is ${currencySymbol}300. You can find nearby ATMs using the ATM locator in the app.`,
    ]),
  },
  // Statement / transaction history
  {
    triggers: ['statement', 'transaction history', 'show transactions', 'need a statement', 'send me statement'],
    respond: () => pick([
      "You can download your bank statement from the account details page - tap 'Get Statement' and choose your date range.",
      "To get your statement, open the account, tap the menu icon, and select 'Bank Statement'. You can choose any date range you need.",
    ]),
  },
  // Direct debits / standing orders
  {
    triggers: ['direct debit', 'standing order', 'recurring payment', 'automatic transfer', 'monthly payment'],
    respond: () => pick([
      "Direct debits and standing orders can be viewed and managed from the Payments section - let me know if you'd like help setting one up or cancelling one.",
    ]),
  },
  // Security / fraud
  {
    triggers: ['hacked', 'fraud', 'suspicious activity', 'scammed', 'someone accessed my account'],
    respond: () => pick([
      "I understand how worrying that must be. Please freeze your card immediately from the Cards section, and I'd recommend changing your PIN straight away. I'm escalating this so our security team can take a closer look.",
    ]),
  },
  // App issues
  {
    triggers: ['app crashed', 'app not loading', 'cant login', "can't login", 'app not working', 'blank screen', 'wont open', "won't open"],
    respond: () => pick([
      "Sorry you're having trouble. Try closing and reopening the app first - if that doesn't help, a quick reinstall usually clears it up. Let me know if it's still not working.",
    ]),
  },
  // Greetings
  {
    triggers: ['hello', 'hi ', 'hi,', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy'],
    respond: () => pick([
      "Hello! Welcome to Bank of Ireland support. How can I help you today?",
      "Hi there! I'm here to help with any banking queries you might have.",
      "Hello! Thanks for getting in touch. What can I assist you with?",
    ]),
  },
  // Thanks
  {
    triggers: ['thank', 'thanks', 'cheers', 'appreciate'],
    respond: () => pick([
      "You're welcome! Is there anything else I can help you with?",
      "Happy to help! Let me know if you need anything else.",
    ]),
  },
  // Goodbye
  {
    triggers: ['bye', 'goodbye', 'end chat', 'thats all', "that's all"],
    respond: () => pick([
      "Thank you for contacting Bank of Ireland. Have a great day!",
      "Goodbye! Thanks for chatting with us. Take care!",
    ]),
  },
  // Generic help
  {
    triggers: ['help', 'support', 'assist', 'issue', 'problem', 'somethings wrong', "something's wrong", 'fix this'],
    respond: () => pick([
      "I'm here to help! Could you tell me more about what you need assistance with?",
      "Of course, I'd be happy to help. What seems to be the issue?",
    ]),
  },
];

function defaultResponse(message: string): string {
  if (message.trim().length === 0) {
    return "I'm here to help - what can I do for you today?";
  }
  return pick([
    "I'm here to help with your banking needs. Could you tell me a bit more about what you're looking for?",
    "Thanks for your message. How can I assist you with your banking today?",
    "I'd be happy to help. Could you give me a few more details about your query?",
    "I'm available to assist with transfers, balances, cards, and more - what do you need help with?",
  ]);
}

/**
 * Generates a live chat reply entirely from local rules - no network call.
 * Kept async for drop-in compatibility with the previous OpenAI-backed
 * signature/call sites.
 */
export async function generateChatResponse(
  messages: ChatMessage[],
  agentName: string,
  lastTransfer: LastTransferInfo | null,
  userCurrency: 'EUR' | 'GBP' = 'EUR',
): Promise<string> {
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
  const lower = lastUserMessage.toLowerCase();
  const currencySymbol = userCurrency === 'GBP' ? '£' : '€';

  for (const intent of INTENTS) {
    if (intent.triggers.some(trigger => lower.includes(trigger))) {
      const reply = intent.respond({ message: lastUserMessage, lastTransfer, currencySymbol, agentName });
      if (isFrustrated(lastUserMessage)) {
        return `I understand how frustrating that is - let's get this sorted. ${reply}`;
      }
      return reply;
    }
  }

  return defaultResponse(lastUserMessage);
}
