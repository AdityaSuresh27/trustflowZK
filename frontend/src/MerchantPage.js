import React, { useState, useEffect, useRef } from 'react';
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

function MerchantPage() {
  const [merchantId, setMerchantId] = useState(localStorage.getItem('merchantId') || '');
  const [amount, setAmount] = useState('');
  const [qrData, setQrData] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [showQR, setShowQR] = useState(false);
  const [validationErrors, setValidationErrors] = useState({}); // Track field-level validation errors
  const canvasRef = useRef(null);

  // Fetch recent transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/recent-payments');
        const data = await response.json();
        setTransactions(data.payments || []);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      }
    };

    // Fetch immediately and then every 5 seconds
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 5000);

    return () => clearInterval(interval);
  }, []);

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

    // Save merchant ID for future use
    localStorage.setItem('merchantId', merchantId);

    try {
      // Automatically fetch network IP from backend
      const response = await fetch('http://localhost:5001/api/network-ip');
      const data = await response.json();
      const networkIP = data.ip || 'localhost';
      
      const port = window.location.port || '3000';
      const paymentUrl = `http://${networkIP}:${port}/?mode=customer&merchantId=${encodeURIComponent(merchantId)}&amount=${encodeURIComponent(amount)}&timestamp=${Date.now()}`;
      
      setQrData(paymentUrl);
      setShowQR(true);

      // Generate QR code on canvas
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

  return (
    <div className="merchant-container">
      <div className="merchant-header">
        <h1>🏪 ZKPulse Merchant Dashboard</h1>
        <p className="tagline">Secure payments powered by Zero-Knowledge Proofs</p>
      </div>

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
          <div className="payment-details">
            <p><strong>Merchant:</strong> {merchantId}</p>
            <p><strong>Amount:</strong> ₹{amount}</p>
            <p className="payment-link-info">Payment Link: <a href={qrData} target="_blank" rel="noopener noreferrer" className="payment-link">{qrData}</a></p>
          </div>
          <div className="action-buttons">
            <button onClick={() => window.open(qrData, '_blank')} className="btn-primary" style={{marginRight: '10px'}}>
              🔗 Open Payment Page
            </button>
            <button onClick={handleNewQR} className="btn-secondary">
              Generate New QR
            </button>
          </div>
        </div>
      )}

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
                  <p><strong>Nullifier:</strong> {tx.nullifier?.substring(0, 20)}...</p>
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
}

export default MerchantPage;
