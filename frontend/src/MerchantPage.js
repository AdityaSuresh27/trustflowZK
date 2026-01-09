import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import './MerchantPage.css';

function MerchantPage() {
  const [merchantId, setMerchantId] = useState(localStorage.getItem('merchantId') || '');
  const [amount, setAmount] = useState('');
  const [qrData, setQrData] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [showQR, setShowQR] = useState(false);
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
    if (!merchantId) {
      alert('Please enter Merchant ID');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
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
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="Enter your Merchant ID"
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label>Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="input-field"
              step="0.01"
              min="0"
            />
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
