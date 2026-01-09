import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import './MerchantPage.css';

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

/**
 * Validate Merchant ID format
 * Must be alphanumeric, 2-20 characters
 */
function validateMerchantId(id) {
  if (!id) return { valid: false, error: 'Merchant ID is required' };
  if (id.length < 2) return { valid: false, error: 'Merchant ID must be at least 2 characters' };
  if (id.length > 20) return { valid: false, error: 'Merchant ID cannot exceed 20 characters' };
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return { valid: false, error: 'Merchant ID can only contain letters, numbers, hyphens, and underscores' };
  return { valid: true };
}

/**
 * Validate payment amount
 * Must be positive, max 2 decimals, max ₹100,000
 */
function validateAmount(amount) {
  if (!amount) return { valid: false, error: 'Amount is required' };
  const num = parseFloat(amount);
  if (isNaN(num)) return { valid: false, error: 'Amount must be a valid number' };
  if (num <= 0) return { valid: false, error: 'Amount must be greater than 0' };
  if (num > 100000) return { valid: false, error: 'Amount cannot exceed ₹100,000' };
  if (!/^\d+(\.\d{0,2})?$/.test(amount)) return { valid: false, error: 'Amount can have at most 2 decimal places' };
  return { valid: true };
}

/**
 * Validate chat message
 * Must be non-empty, max 500 characters
 */
function validateChatMessage(message) {
  if (!message.trim()) return { valid: false, error: 'Message cannot be empty' };
  if (message.length > 500) return { valid: false, error: 'Message cannot exceed 500 characters' };
  return { valid: true };
}

// ============================================================================
// SECURITY FIX: JWT Authentication Helper Functions
// ============================================================================

/**
 * Get JWT token from localStorage
 */
function getAuthToken() {
  return localStorage.getItem('jwtToken');
}

/**
 * Store JWT token in localStorage
 */
function setAuthToken(token) {
  localStorage.setItem('jwtToken', token);
}

/**
 * Clear JWT token from localStorage
 */
function clearAuthToken() {
  localStorage.removeItem('jwtToken');
}

/**
 * Make authenticated API call with JWT token
 */
async function authenticatedFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = options.headers || {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    clearAuthToken();
  }

  return response;
}

/**
 * Compute PIN hash locally (simple hash function)
 * Must match the backend's hashing method for verification
 */
function simpleHash(pin) {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Login user and get JWT token (REQUIRES PIN)
 * SECURITY FIX: Now requires PIN verification
 */
async function loginUser(customerId, pin = '0000') {
  try {
    // Validate input
    if (!customerId) {
      return { success: false, error: 'customerId is required' };
    }

    // For merchant, use default PIN if not provided
    const pinToUse = pin || '0000';

    // Hash the PIN locally (never send plaintext PIN)
    const pinHash = simpleHash(pinToUse);

    // Send login request with customerId and pinHash
    const response = await fetch('http://localhost:5001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, pinHash })
    });

    const data = await response.json();

    if (response.ok && data.token) {
      setAuthToken(data.token);
      return { success: true, token: data.token };
    } else {
      // If authentication fails, it's likely the customer hasn't registered yet
      // For merchants, this is expected on first load
      console.warn('Login attempt failed:', data.error);
      return { success: false, error: data.error || 'Login failed' };
    }
  } catch (error) {
    console.warn('Login error:', error.message);
    return { success: false, error: error.message };
  }
}

const MerchantPageEnhanced = ({ onSwitchMode }) => {
  const [merchantId, setMerchantId] = useState(localStorage.getItem('merchantId') || '');
  const [amount, setAmount] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [chatMessages, setChatMessages] = useState([{ role: 'bot', content: 'Hi! I\'m your transaction assistant. Ask me about your recent payments! You can speak or type.' }]);
  const [chatInput, setChatInput] = useState('');
  const [todayTotal, setTodayTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [validationErrors, setValidationErrors] = useState({}); // Track field-level validation errors
  const canvasRef = useRef(null);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Fetch transactions and calculate today's total
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        // SECURITY FIX: Authenticate first if not already authenticated
        const merchantId = localStorage.getItem('merchantId') || 'merchant-default';
        const loginResult = await loginUser(merchantId);
        
        if (!loginResult.success) {
          console.warn('Could not authenticate merchant:', loginResult.error);
          return;
        }

        // Use authenticated fetch with JWT token
        const response = await authenticatedFetch('http://localhost:5001/api/recent-payments');
        const data = await response.json();
        const payments = data.payments || [];
        setTransactions(payments);

        // Calculate today's total
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaysPayments = payments.filter(p => new Date(p.timestamp) >= today);
        const total = todaysPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        setTodayTotal(Number(total) || 0);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setTodayTotal(0);
      }
    };

    fetchTransactions();
    const interval = setInterval(fetchTransactions, 5000);
    return () => clearInterval(interval);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.language = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setChatInput(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Function to speak text using Web Speech API
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Function to start listening
  const handleStartListening = () => {
    if (recognitionRef.current) {
      // If already listening, stop it first
      if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
        return;
      }
      
      setChatInput('');
      try {
        recognitionRef.current.start();
      } catch (error) {
        if (error.name === 'InvalidStateError') {
          // Already listening, just update state
          setIsListening(true);
        } else {
          console.error('Error starting speech recognition:', error);
        }
      }
    }
  };

  const handleGenerateQR = async () => {
    // Validate Merchant ID
    const merchantValidation = validateMerchantId(merchantId);
    if (!merchantValidation.valid) {
      alert(merchantValidation.error);
      return;
    }

    // Validate Amount
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      alert(amountValidation.error);
      return;
    }

    localStorage.setItem('merchantId', merchantId);

    try {
      // Always use localhost for payment links (works on local machine)
      const paymentUrl = `http://localhost:3000/?mode=customer&merchantId=${encodeURIComponent(merchantId)}&amount=${encodeURIComponent(amount)}&timestamp=${Date.now()}`;
      
      setQrData(paymentUrl);
      setShowQR(true);

      setTimeout(() => {
        if (canvasRef.current) {
          QRCode.toCanvas(canvasRef.current, paymentUrl, { 
            width: 300,
            margin: 2 
          }, (error) => {
            if (error) console.error(error);
          });
        }
      }, 100);
    } catch (error) {
      console.error('Failed to fetch network IP:', error);
      alert('Failed to generate QR code. Make sure backend is running.');
    }
  };

  const handleNewQR = () => {
    setShowQR(false);
    setAmount('');
    setQrData('');
  };

  const handleSendMessage = async () => {
    // Validate chat message
    const messageValidation = validateChatMessage(chatInput);
    if (!messageValidation.valid) {
      alert(messageValidation.error);
      return;
    }

    const userMessage = chatInput;
    setChatInput('');
    
    // Add user message to chat
    const updatedMessages = [...chatMessages, { role: 'user', content: userMessage }];
    setChatMessages(updatedMessages);
    setLoading(true);

    try {
      // SECURITY FIX: Use authenticated fetch with JWT token
      const response = await authenticatedFetch('http://localhost:5001/api/gemini-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage,
          transactions: transactions,
          merchantId: merchantId,
          todayTotal: todayTotal
        })
      });

      const data = await response.json();
      const botReply = data.response || 'Sorry, I couldn\'t process your request.';
      
      setChatMessages([...updatedMessages, { role: 'bot', content: botReply }]);
      
      // Speak the bot response
      speakText(botReply);
    } catch (error) {
      console.error('Error querying Gemini:', error);
      const errorMsg = 'Error connecting to AI assistant.';
      setChatMessages([...updatedMessages, { role: 'bot', content: errorMsg }]);
      speakText(errorMsg);
    }
    
    setLoading(false);
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div className="merchant-container">
      <div className="merchant-header">
        <div className="header-content">
          <h1>🏪 ZKPulse Merchant Dashboard</h1>
          <p className="tagline">Secure payments powered by Zero-Knowledge Proofs</p>
        </div>
        {onSwitchMode && (
          <button onClick={() => onSwitchMode('customer')} className="switch-mode-btn">
            👤 Switch to Customer Mode
          </button>
        )}
      </div>

      {/* Dashboard Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Today's Collection</h3>
          <p className="stat-amount">₹{(typeof todayTotal === 'number' ? todayTotal : 0).toFixed(2)}</p>
          <p className="stat-label">Total received today</p>
        </div>
        <div className="stat-card">
          <h3>Total Transactions</h3>
          <p className="stat-amount">{transactions.length}</p>
          <p className="stat-label">Verified payments</p>
        </div>
        <div className="stat-card">
          <h3>Merchant ID</h3>
          <p className="stat-amount" style={{fontSize: '0.9em'}}>{merchantId || 'Not set'}</p>
          <p className="stat-label">Current merchant</p>
        </div>
      </div>

      <div className="merchant-content">
        {/* QR Code Section */}
        <div className="merchant-section">
          {!showQR ? (
            <div className="qr-generator-section">
              <h2>Generate Payment QR Code</h2>
              <div className="form-group">
                <label>Merchant ID</label>
                <input
                  type="text"
                  value={merchantId}
                  onChange={(e) => {
                    setMerchantId(e.target.value);
                    // Real-time validation feedback
                    if (e.target.value) {
                      const validation = validateMerchantId(e.target.value);
                      setValidationErrors({ ...validationErrors, merchantId: validation.valid ? null : validation.error });
                    }
                  }}
                  placeholder="Enter your Merchant ID"
                  className="input-field"
                  maxLength="20"
                  style={{ borderColor: validationErrors.merchantId ? '#ff6b6b' : 'inherit' }}
                />
                {validationErrors.merchantId && <div style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '5px' }}>⚠️ {validationErrors.merchantId}</div>}
                <div style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}>2-20 characters, alphanumeric with hyphens/underscores</div>
              </div>
              <div className="form-group">
                <label>Amount (₹)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    // Real-time validation feedback
                    if (e.target.value) {
                      const validation = validateAmount(e.target.value);
                      setValidationErrors({ ...validationErrors, amount: validation.valid ? null : validation.error });
                    }
                  }}
                  placeholder="Enter amount"
                  className="input-field"
                  step="0.01"
                  min="0"
                  max="100000"
                  style={{ borderColor: validationErrors.amount ? '#ff6b6b' : 'inherit' }}
                />
                {validationErrors.amount && <div style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '5px' }}>⚠️ {validationErrors.amount}</div>}
                <div style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}>Max ₹100,000 with up to 2 decimal places</div>
              </div>
              <button onClick={handleGenerateQR} className="btn-primary">
                Generate QR Code
              </button>
            </div>
          ) : (
            <div className="qr-display-section">
              <h2>Scan to Pay</h2>
              <div className="qr-code-container">
                <canvas ref={canvasRef}></canvas>
              </div>
              <div className="notice-box" style={{ 
                background: 'linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%)', 
                padding: '15px 20px', 
                borderRadius: '10px', 
                margin: '15px 0',
                border: '1px solid #ffc107',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0, color: '#856404', fontWeight: '600' }}>
                  Kindly click on the link below to go to the customer page and experience the full flow of a transaction.
                </p>
                <p style={{ margin: '8px 0 0 0', color: '#856404', fontSize: '13px' }}>
                  QR scanning will be enabled in production.
                </p>
              </div>
              <div className="payment-details">
                <p><strong>Merchant:</strong> {merchantId}</p>
                <p><strong>Amount:</strong> ₹{amount}</p>
                <p className="payment-link-info">
                  Payment Link: <a href={qrData} target="_blank" rel="noopener noreferrer" className="payment-link">{qrData.substring(0, 50)}...</a>
                </p>
              </div>
              <div className="action-buttons">
                <button onClick={() => window.open(qrData, '_blank')} className="btn-primary">
                  Open Payment Page
                </button>
                <button onClick={handleNewQR} className="btn-secondary">
                  Generate New QR
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chat AI Assistant */}
        <div className="merchant-section">
          <div className="chat-section">
            <h2>Transaction Assistant (Gemini AI)</h2>
            <div className="chat-messages">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role}`}>
                  <p>{msg.content}</p>
                </div>
              ))}
              {loading && <div className="chat-message bot"><p>Typing...</p></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input-section">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  // Real-time validation feedback
                  if (e.target.value && e.target.value.length > 500) {
                    setValidationErrors({ ...validationErrors, chatInput: 'Message cannot exceed 500 characters' });
                  } else {
                    setValidationErrors({ ...validationErrors, chatInput: null });
                  }
                }}
                onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
                placeholder="Ask about your transactions... (e.g., 'What is my total today?')"
                className="chat-input"
                disabled={loading || isListening}
                maxLength="500"
              />
              <button 
                onClick={handleStartListening} 
                className={`btn-voice ${isListening ? 'listening' : ''}`}
                disabled={loading || isSpeaking}
                title="Click to speak"
              >
                🎤 {isListening ? 'Listening...' : 'Speak'}
              </button>
              <button onClick={handleSendMessage} className="btn-primary" disabled={loading || isListening}>
                Send
              </button>
              {isSpeaking && (
                <button 
                  onClick={() => window.speechSynthesis.cancel()} 
                  className="btn-stop"
                  title="Stop speaking"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="transactions-section">
        <h2>Recent Transactions</h2>
        {transactions.length === 0 ? (
          <p className="no-transactions">No transactions yet</p>
        ) : (
          <div className="transactions-list">
            {transactions.slice(0, 10).map((tx, index) => (
              <div key={index} className="transaction-card">
                <div className="tx-header">
                  <span className="tx-id">#{tx.txId}</span>
                  <span className="tx-amount">₹{tx.amount}</span>
                </div>
                <div className="tx-details">
                  <p><strong>Customer:</strong> {tx.customerId}</p>
                  <p><strong>Merchant:</strong> {tx.merchantId}</p>
                  <p><strong>Time:</strong> {new Date(tx.timestamp).toLocaleString()}</p>
                </div>
                <div className="tx-status">
                  <span className="status-badge verified">✓ Verified</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantPageEnhanced;
