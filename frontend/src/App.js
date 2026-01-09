import React, { useState, useEffect } from 'react';
import './App.css';
import MerchantPageEnhanced from './MerchantPageEnhanced';

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

/**
 * Validate Customer ID format
 * Must be alphanumeric, 3-20 characters
 */
function validateCustomerId(id) {
  if (!id) return { valid: false, error: 'Customer ID is required' };
  if (id.length < 3) return { valid: false, error: 'Customer ID must be at least 3 characters' };
  if (id.length > 20) return { valid: false, error: 'Customer ID cannot exceed 20 characters' };
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return { valid: false, error: 'Customer ID can only contain letters, numbers, hyphens, and underscores' };
  return { valid: true };
}

/**
 * Validate PIN format
 * Must be numeric, 4-6 digits
 */
function validatePin(pin) {
  if (!pin) return { valid: false, error: 'PIN is required' };
  if (!/^\d+$/.test(pin)) return { valid: false, error: 'PIN must contain only digits' };
  if (pin.length < 4) return { valid: false, error: 'PIN must be at least 4 digits' };
  if (pin.length > 6) return { valid: false, error: 'PIN cannot exceed 6 digits' };
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

// ============================================================================
// SECURITY FIX: JWT Authentication Helper
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
 * Automatically includes Authorization header if token exists
 */
async function authenticatedFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = options.headers || {};

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Ensure Content-Type is set for JSON
  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // If 401 Unauthorized, token might be expired - clear it
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
 * - customerId: The customer's unique identifier
 * - pin: The customer's 4-6 digit PIN (will be hashed locally)
 */
async function loginUser(customerId, pin) {
  try {
    // Validate input
    if (!customerId || !pin) {
      return { success: false, error: 'customerId and PIN are required' };
    }

    // Hash the PIN locally (never send plaintext PIN)
    const pinHash = simpleHash(pin);

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
      return { success: false, error: data.error || data.message || 'Login failed' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function App() {
  const [viewMode, setViewMode] = useState('home'); // home, customer, merchant
  const [screen, setScreen] = useState('home'); // home, register, scan, amount, pin, processing, success, error
  const [customerId, setCustomerId] = useState(localStorage.getItem('customerId') || '');
  const [registeredPin, setRegisteredPin] = useState(false);
  const [merchantId, setMerchantId] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({}); // Track field-level validation errors

  // Check if customer already has registered PIN on mount
  useEffect(() => {
    const storedCustomerId = localStorage.getItem('customerId');
    const storedPinHash = localStorage.getItem('pinHash');
    
    if (storedCustomerId && storedPinHash) {
      setCustomerId(storedCustomerId);
      setRegisteredPin(true);
    }
  }, []);

  // Check URL parameters when component mounts (for QR code scans)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const urlMerchantId = urlParams.get('merchantId');
    const urlAmount = urlParams.get('amount');

    if (mode === 'customer') {
      setViewMode('customer');
      
      // Auto-fill merchant ID and amount from QR code
      if (urlMerchantId) setMerchantId(urlMerchantId);
      if (urlAmount) setAmount(urlAmount);
      
      // Always show customer home screen (with Register/Sign In options)
      // Don't skip directly to PIN entry
      setScreen('home');
    }
  }, []);

  // Show merchant page if in merchant mode
  if (viewMode === 'merchant') {
    return <MerchantPageEnhanced onSwitchMode={setViewMode} />;
  }

  // Step 0: PIN Registration
  const handleRegisterPin = async () => {
    // Validate Customer ID
    const customerValidation = validateCustomerId(customerId);
    if (!customerValidation.valid) {
      setError(customerValidation.error);
      return;
    }

    // Validate PIN
    const pinValidation = validatePin(pin);
    if (!pinValidation.valid) {
      setError(pinValidation.error);
      return;
    }

    // Clear validation errors on submit
    setValidationErrors({});

    try {
      setScreen('processing');
      
      // SECURITY FIX: Step 1 - Authenticate user first (now requires PIN)
      const loginResult = await loginUser(customerId, pin);
      if (!loginResult.success) {
        setError('Authentication failed: ' + loginResult.error);
        setScreen('register');
        return;
      }

      // Calculate PIN hash locally (demo: simple hash)
      const pinHash = simpleHash(pin);
      const salt = 'demo_salt_' + Date.now(); // In production: from snarkjs circuit

      // SECURITY FIX: Step 2 - Send registration with Authorization header
      const res = await authenticatedFetch('http://localhost:5001/api/register-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          pinHash,
          salt
        })
      });

      const data = await res.json();

      if (data.status === 'success') {
        localStorage.setItem('customerId', customerId);
        localStorage.setItem('pinHash', pinHash);
        setRegisteredPin(true);
        setError('');
        
        // Check if user came from QR scan (has merchant ID and amount)
        if (merchantId && amount) {
          // Proceed to PIN entry for payment
          setPin('');
          setResponse('✓ PIN registered! Now enter PIN to complete payment.');
          setTimeout(() => {
            setScreen('pin');
          }, 1500);
        } else {
          // Regular registration flow
          setPin('');
          setResponse('✓ PIN registered successfully! You can now make payments.');
          setScreen('success');
        }
      } else {
        setError(data.error || 'Registration failed');
        setScreen('error');
      }
    } catch (err) {
      setError('Error: ' + err.message);
      setScreen('error');
    }
  };

  // Handle Sign In
  const handleSignIn = () => {
    // Validate Customer ID
    const customerValidation = validateCustomerId(customerId);
    if (!customerValidation.valid) {
      setError(customerValidation.error);
      return;
    }

    // Validate PIN
    const pinValidation = validatePin(pin);
    if (!pinValidation.valid) {
      setError(pinValidation.error);
      return;
    }

    // Check if stored credentials match
    const storedCustomerId = localStorage.getItem('customerId');
    const storedPinHash = localStorage.getItem('pinHash');
    const claimedPinHash = simpleHash(pin);

    if (!storedCustomerId || !storedPinHash) {
      setError('No account found. Please register first.');
      return;
    }

    if (storedCustomerId !== customerId) {
      setError('Customer ID not found');
      return;
    }

    if (storedPinHash !== claimedPinHash) {
      setError('Wrong PIN');
      return;
    }

    // Sign in successful
    setRegisteredPin(true);
    setError('');
    
    // Check if user came from QR scan (has merchant ID and amount)
    if (merchantId && amount) {
      // Proceed to PIN entry for payment
      setPin('');
      setScreen('pin');
    } else {
      // Show success message
      setResponse('✓ Signed in successfully!');
      setTimeout(() => {
        setScreen('home');
      }, 1500);
    }
  };

  // Step 1: Handle QR Code Scan (simulated with manual input for demo)
  const handleScanQR = () => {
    if (!registeredPin) {
      setError('Please register your PIN first!');
      return;
    }
    const demoMerchantId = 'MERCHANT_' + Math.random().toString(36).substr(2, 9);
    setMerchantId(demoMerchantId);
    setScreen('amount');
    setError('');
  };

  // Step 1: Get Amount Input
  const handleAmountSubmit = () => {
    // Validate Amount
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      setError(amountValidation.error);
      return;
    }
    setScreen('pin');
    setError('');
  };

  // Step 1: Get PIN Input for Payment
  const handlePINSubmit = async () => {
    // Validate PIN
    const pinValidation = validatePin(pin);
    if (!pinValidation.valid) {
      setError(pinValidation.error);
      return;
    }
    setError('');
    setScreen('processing');
    await submitPayment();
  };

  // Step 2-5: Submit Payment with PIN Verification
  const submitPayment = async () => {
    try {
      // Calculate PIN hash locally
      const claimedPinHash = simpleHash(pin);
      const storedPinHash = localStorage.getItem('pinHash');

      // Pre-check: Do hashes match?
      if (claimedPinHash !== storedPinHash) {
        setError('Wrong PIN! The hash does not match your registered PIN.');
        setScreen('error');
        return;
      }

      // Generate a dummy proof for demo (in production: use snarkjs)
      const proof = {
        pi_a: ['0x' + '1'.repeat(64), '0x' + '2'.repeat(64)],
        pi_b: [
          ['0x' + '3'.repeat(64), '0x' + '4'.repeat(64)],
          ['0x' + '5'.repeat(64), '0x' + '6'.repeat(64)]
        ],
        pi_c: ['0x' + '7'.repeat(64), '0x' + '8'.repeat(64)]
      };

      const publicSignals = [
        '0x' + amount.toString().padStart(64, '0'),
        '0x' + Math.random().toString(36).substr(2, 63) // Nullifier
      ];

      // SECURITY FIX: Use authenticated fetch with JWT token
      const res = await authenticatedFetch('http://localhost:5001/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof,
          publicSignals,
          amount,
          merchantId,
          pinHash: claimedPinHash,
          customerId
        })
      });

      const data = await res.json();

      if (data.verified) {
        setResponse(data.message);
        announceSuccess(`Verification complete. ${amount} rupees received via ZK-Shield.`);
        setScreen('success');
      } else {
        setError(data.message || 'Payment verification failed');
        setScreen('error');
      }
    } catch (err) {
      setError('Backend error: ' + err.message);
      setScreen('error');
    }
  };

  // Step 6: Voice Announcement
  const announceSuccess = (message) => {
    const speech = new SpeechSynthesisUtterance(message);
    window.speechSynthesis.speak(speech);
  };

  const handleReset = () => {
    setAmount('');
    setPin('');
    setMerchantId('');
    setError('');
    
    // If user is registered, go to home (which will show transaction options)
    // If not registered, also go to home (which will show registration options)
    setScreen('home');
  };

  return (
    <div className="app-container">
      <style>{`
        .app-container {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .screen {
          background: white;
          border-radius: 20px;
          padding: 30px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          text-align: center;
        }
        h1 { color: #333; margin: 0 0 20px 0; }
        .qr-icon { font-size: 60px; margin: 20px 0; }
        button {
          width: 100%;
          padding: 15px;
          margin: 10px 0;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          background: #667eea;
          color: white;
          transition: background 0.3s;
        }
        button:hover { background: #764ba2; }
        input {
          width: 100%;
          padding: 15px;
          margin: 10px 0;
          border: 2px solid #ddd;
          border-radius: 10px;
          font-size: 16px;
          box-sizing: border-box;
        }
        input:focus {
          outline: none;
          border-color: #667eea;
        }
        .error { color: #e74c3c; font-weight: bold; margin: 10px 0; }
        .success { color: #27ae60; font-weight: bold; margin: 10px 0; }
        .spinner {
          border: 4px solid #ddd;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .pulse {
          width: 60px;
          height: 60px;
          background: #27ae60;
          border-radius: 50%;
          margin: 20px auto;
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(39, 174, 96, 0.7); }
          50% { box-shadow: 0 0 0 20px rgba(39, 174, 96, 0); }
        }
        .info { background: #e3f2fd; padding: 15px; border-radius: 10px; margin: 10px 0; font-size: 13px; color: #1976d2; }
      `}</style>

      {screen === 'home' && viewMode === 'home' && (
        <div className="screen">
          <h1>ZKPulse</h1>
          <p>Zero-Knowledge Payment Verification</p>
          <div className="qr-icon">🔐</div>
          <div style={{marginTop: '40px'}}>
            <button 
              onClick={() => setViewMode('merchant')}
              style={{
                padding: '20px 40px',
                fontSize: '1.2em',
                margin: '10px',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                width: '80%',
                maxWidth: '300px'
              }}
            >
              🏪 Merchant Dashboard
            </button>
            <p style={{ fontSize: '12px', color: '#ddd', marginTop: '20px' }}>
              💡 Scan merchant QR code to make payments
            </p>
          </div>
        </div>
      )}

      {screen === 'home' && viewMode === 'customer' && (
        <div className="screen">
          <h1>Customer Portal</h1>
          <p>Zero-Knowledge Payment Verification</p>
          <div className="qr-icon">🔐</div>
          {merchantId && amount && (
            <div className="info" style={{ background: '#fff3cd', color: '#856404', marginBottom: '15px' }}>
              💰 Payment: ₹{amount} to {merchantId}
            </div>
          )}
          <div>
            {/* Always show Register/Sign In options - customer must authenticate first */}
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>Choose an option to continue</p>
            <button onClick={() => setScreen('register')} style={{ marginBottom: '10px' }}>📝 Register New Account</button>
            <button onClick={() => setScreen('signin')} style={{ background: '#27ae60' }}>🔑 Sign In</button>
          </div>
        </div>
      )}

      {screen === 'register' && (
        <div className="screen">
          <h1>Register Your PIN</h1>
          <div className="info">🔒 Your PIN will be hashed locally. Never sent to server in plain text.</div>
          {merchantId && amount && (
            <div className="info" style={{ background: '#fff3cd', color: '#856404', marginBottom: '15px' }}>
              💰 Payment: ₹{amount} to {merchantId}
              <br/>
              Please set your PIN to complete this transaction
            </div>
          )}
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="Customer ID (e.g., cust_123)"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                // Real-time validation feedback
                if (e.target.value) {
                  const validation = validateCustomerId(e.target.value);
                  setValidationErrors({ ...validationErrors, customerId: validation.valid ? null : validation.error });
                }
              }}
              maxLength="20"
              style={{ borderColor: validationErrors.customerId ? '#ff6b6b' : '#ddd' }}
            />
            {validationErrors.customerId && <div style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '5px' }}>⚠️ {validationErrors.customerId}</div>}
            <div style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}>3-20 characters, alphanumeric with hyphens/underscores</div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <input
              type="password"
              placeholder="Set your 4-digit PIN"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                // Real-time validation feedback
                if (e.target.value) {
                  const validation = validatePin(e.target.value);
                  setValidationErrors({ ...validationErrors, pin: validation.valid ? null : validation.error });
                }
              }}
              maxLength="6"
              inputMode="numeric"
              style={{ borderColor: validationErrors.pin ? '#ff6b6b' : '#ddd' }}
            />
            {validationErrors.pin && <div style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '5px' }}>⚠️ {validationErrors.pin}</div>}
            <div style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}>4-6 digits only</div>
          </div>
          {error && <div className="error">{error}</div>}
          {response && <div className="success">{response}</div>}
          <button onClick={handleRegisterPin}>✓ Register PIN</button>
          <button style={{ background: '#999' }} onClick={() => { setScreen('home'); setError(''); setPin(''); }}>Back</button>
        </div>
      )}

      {screen === 'signin' && (
        <div className="screen">
          <h1>Sign In</h1>
          <div className="info">🔑 Enter your credentials to continue</div>
          {merchantId && amount && (
            <div className="info" style={{ background: '#fff3cd', color: '#856404', marginBottom: '15px' }}>
              💰 Payment: ₹{amount} to {merchantId}
            </div>
          )}
          <input
            type="text"
            placeholder="Customer ID"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            maxLength="20"
          />
          <input
            type="password"
            placeholder="Enter your PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength="6"
            inputMode="numeric"
          />
          {error && <div className="error">{error}</div>}
          <button onClick={handleSignIn}>✓ Sign In</button>
          <button style={{ background: '#999' }} onClick={() => { setScreen('home'); setError(''); setPin(''); setCustomerId(''); }}>Back</button>
        </div>
      )}

      {screen === 'amount' && (
        <div className="screen">
          <h1>Enter Amount</h1>
          <p>Merchant: {merchantId}</p>
          <div style={{ marginBottom: '15px' }}>
            <input
              type="number"
              placeholder="Enter amount in ₹"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                // Real-time validation feedback
                if (e.target.value) {
                  const validation = validateAmount(e.target.value);
                  setValidationErrors({ ...validationErrors, amount: validation.valid ? null : validation.error });
                }
              }}
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100000"
              style={{ borderColor: validationErrors.amount ? '#ff6b6b' : '#ddd' }}
            />
            {validationErrors.amount && <div style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '5px' }}>⚠️ {validationErrors.amount}</div>}
            <div style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}>Max ₹100,000 with up to 2 decimal places</div>
          </div>
          {error && <div className="error">{error}</div>}
          <button onClick={handleAmountSubmit}>Next</button>
        </div>
      )}

      {screen === 'pin' && (
        <div className="screen">
          <h1>Enter PIN to Authorize Payment</h1>
          <p>Merchant: {merchantId}</p>
          <p>Amount: ₹{amount}</p>
          <div className="info">🔑 Enter your PIN to complete this transaction</div>
          <input
            type="password"
            placeholder="Enter 4-digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength="6"
            inputMode="numeric"
          />
          {error && <div className="error">{error}</div>}
          <button onClick={handlePINSubmit}>✓ Verify & Pay</button>
          <button style={{ background: '#999' }} onClick={() => { setScreen('home'); setPin(''); setError(''); }}>Cancel</button>
        </div>
      )}

      {screen === 'processing' && (
        <div className="screen">
          <h1>Processing...</h1>
          <p>Verifying PIN & Processing Payment</p>
          <div className="spinner"></div>
          <p style={{ fontSize: '12px', color: '#999' }}>Do not close this window</p>
        </div>
      )}

      {screen === 'success' && (
        <div className="screen">
          <h1>✅ Payment Verified</h1>
          <div className="pulse"></div>
          <p className="success">{response}</p>
          <p style={{ fontSize: '14px', color: '#666' }}>Amount: ₹{amount}</p>
          <button onClick={() => { setViewMode('merchant'); setScreen('home'); setMerchantId(''); setAmount(''); setPin(''); }}>Back to Merchant Dashboard</button>
        </div>
      )}

      {screen === 'error' && (
        <div className="screen">
          <h1>❌ Verification Failed</h1>
          <p className="error">{error || response}</p>
          <button style={{ background: '#e74c3c' }} onClick={() => { setScreen('pin'); setError(''); }}>Retry PIN</button>
          <button style={{ background: '#999' }} onClick={() => { setViewMode('merchant'); setScreen('home'); setMerchantId(''); setAmount(''); setPin(''); }}>Back to Merchant Dashboard</button>
        </div>
      )}
    </div>
  );
}

export default App;