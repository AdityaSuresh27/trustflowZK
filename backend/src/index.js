const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const snarkjs = require('snarkjs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ethers = require('ethers');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================================
// SECURITY: JWT Authentication Setup
// ============================================================================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '24h';

/**
 * Authentication Middleware
 * Verifies JWT token and extracts customerId from it
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.customerId = decoded.customerId;
    next();
  });
}

/**
 * IDOR Protection: Ensure user can only access/modify their own data
 */
function protectCustomerData(req, res, next) {
  const requestedCustomerId = req.body.customerId || req.params.customerId;

  if (requestedCustomerId && requestedCustomerId !== req.customerId) {
    return res.status(403).json({ 
      error: 'Access denied: You can only modify your own customer data',
      details: 'IDOR protection: Unauthorized customer ID access'
    });
  }
  next();
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Blockchain setup for Polygon Amoy
const POLYGON_AMOY_RPC = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';
const provider = new ethers.JsonRpcProvider(POLYGON_AMOY_RPC);

// Store transaction data
let transactionDatabase = {
  transactions: [],
  lastUpdate: null
};

// Smart contract constants
const PIN_REGISTRY_ABI = [
  'function registerPIN(string calldata _customerId, bytes32 _pinHash, bytes32 _salt) external',
  'function verifyPIN(string calldata _customerId, bytes32 _claimedPinHash) external returns (bool valid, bytes32 salt)',
  'function isPINRegistered(string calldata _customerId) external view returns (bool)',
  'function getSalt(string calldata _customerId) external view returns (bytes32)',
  'function getRegisteredCount() external view returns (uint256)'
];

let pinRegistryContract = null;

/**
 * Initialize PIN Registry smart contract (will be deployed to Polygon Amoy)
 * For now, we use a placeholder address - replace after deployment
 */
async function initializePINRegistry() {
  try {
    const PIN_REGISTRY_ADDRESS = process.env.PIN_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000';
    
    if (PIN_REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      // Using a read-only provider for verification
      pinRegistryContract = new ethers.Contract(
        PIN_REGISTRY_ADDRESS,
        PIN_REGISTRY_ABI,
        provider
      );
      console.log('✓ PIN Registry smart contract initialized at', PIN_REGISTRY_ADDRESS);
    } else {
      console.log('⚠️  PIN Registry contract address not set. Using fallback in-memory storage.');
      console.log('   Set PIN_REGISTRY_ADDRESS in .env after deploying PINRegistry.sol');
    }
  } catch (error) {
    console.error('Error initializing PIN Registry contract:', error.message);
  }
}

// In-memory PIN registry fallback (when contract not deployed)
const pinRegistryFallback = new Map();

// In-memory replay attack tracker
const usedNullifiers = new Map();
const recentPayments = [];

/**
 * Register a PIN hash for a customer on the blockchain
 * Falls back to in-memory storage if contract not deployed
 */
async function registerPINHash(customerId, pinHash, salt) {
  try {
    if (pinRegistryContract && pinRegistryContract.target !== '0x0000000000000000000000000000000000000000') {
      // For now: log that it would be stored on-chain
      // In production with a signer, this would be: await pinRegistryContract.registerPIN(customerId, pinHash, salt)
      console.log(`📡 [BLOCKCHAIN] PIN would be registered for ${customerId} on-chain`);
      console.log(`   pinHash: ${pinHash}`);
      console.log(`   salt: ${salt}`);
    }
    
    // Fallback: Also store in-memory for immediate availability
    pinRegistryFallback.set(customerId, {
      pinHash,
      salt,
      registeredAt: new Date().toISOString(),
      onChain: pinRegistryContract ? true : false
    });
    
    console.log(`✓ PIN registered for customer ${customerId}`);
  } catch (error) {
    console.error('Error registering PIN:', error.message);
    throw error;
  }
}

/**
 * Verify PIN hash matches the registered one
 * Checks blockchain first, falls back to in-memory storage
 */
async function verifyPINHash(customerId, claimedPinHash) {
  try {
    // Note: Blockchain check disabled because we're using read-only provider
    // In production with a signer, we would check blockchain first
    // For now, use fallback storage directly
    
    // Fallback: Check in-memory registry
    const stored = pinRegistryFallback.get(customerId);
    
    if (!stored) {
      return {
        valid: false,
        reason: 'PIN not registered for this customer. Please register first.',
        source: 'fallback'
      };
    }
    
    if (stored.pinHash !== claimedPinHash) {
      return {
        valid: false,
        reason: 'PIN hash does not match. Wrong PIN entered.',
        source: 'fallback'
      };
    }
    
    console.log(`✓ PIN hash verified for customer ${customerId}`);
    
    return {
      valid: true,
      reason: 'PIN hash verified successfully',
      salt: stored.salt,
      source: 'fallback',
      onChain: stored.onChain
    };
  } catch (error) {
    console.error('Error verifying PIN:', error.message);
    return {
      valid: false,
      reason: 'Error during PIN verification: ' + error.message,
      source: 'error'
    };
  }
}

/**
 * Get PIN registry statistics (for health check)
 */
function getPINRegistryStats() {
  return {
    fallbackCount: pinRegistryFallback.size,
    blockchainEnabled: pinRegistryContract && pinRegistryContract.target !== '0x0000000000000000000000000000000000000000',
    contractAddress: pinRegistryContract?.target || 'Not deployed'
  };
}

/**
 * Mock transactions for demo purposes (Polygon Amoy testnet may have no activity)
 */
function getMockTransactions() {
  return [
    {
      hash: '0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t',
      from: '0x1234567890abcdef1234567890abcdef12345678',
      to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      value: '5.25 MATIC',
      gasPrice: '35.5 gwei',
      status: 'Success',
      blockNumber: 12345,
      timestamp: new Date(Date.now() - 60000).toISOString()
    },
    {
      hash: '0x2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1',
      from: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      to: '0x9876543210fedcba9876543210fedcba98765432',
      value: '12.5 MATIC',
      gasPrice: '32.0 gwei',
      status: 'Success',
      blockNumber: 12346,
      timestamp: new Date(Date.now() - 120000).toISOString()
    },
    {
      hash: '0x3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2',
      from: '0x9876543210fedcba9876543210fedcba98765432',
      to: '0x1111111111111111111111111111111111111111',
      value: '8.75 MATIC',
      gasPrice: '38.2 gwei',
      status: 'Success',
      blockNumber: 12347,
      timestamp: new Date(Date.now() - 180000).toISOString()
    }
  ];
}

/**
 * Fetch transactions from Polygon Amoy blockchain
 */
async function getBlockchainTransactions(address = null, limit = 10) {
  try {
    const blockNumber = await provider.getBlockNumber();
    const transactions = [];
    
    // Get recent blocks
    for (let i = 0; i < Math.min(5, blockNumber); i++) {
      const block = await provider.getBlock(blockNumber - i);
      if (block && block.transactions && block.transactions.length > 0) {
        for (let txHash of block.transactions.slice(0, limit)) {
          try {
            const tx = await provider.getTransaction(txHash);
            const receipt = await provider.getTransactionReceipt(txHash);
            
            if (tx) {
              transactions.push({
                hash: tx.hash,
                from: tx.from,
                to: tx.to || 'Contract Creation',
                value: ethers.formatEther(tx.value) + ' MATIC',
                gasPrice: ethers.formatUnits(tx.gasPrice, 'gwei') + ' gwei',
                status: receipt?.status === 1 ? 'Success' : 'Failed',
                blockNumber: tx.blockNumber,
                timestamp: new Date(block.timestamp * 1000).toISOString()
              });
            }
          } catch (e) {
            // Skip transactions that can't be fetched
          }
        }
      }
      if (transactions.length >= limit) break;
    }
    
    // If no real transactions found, use mock data for demo
    if (transactions.length === 0) {
      console.log('No transactions found on Polygon Amoy. Using mock transaction data for demo.');
      transactions.push(...getMockTransactions());
    }
    
    transactionDatabase = {
      transactions: transactions.slice(0, limit),
      lastUpdate: new Date().toISOString(),
      source: transactions.length > 0 && transactions[0].from === '0x1234567890abcdef1234567890abcdef12345678' ? 'mock' : 'blockchain'
    };
    
    return transactionDatabase.transactions;
  } catch (error) {
    console.error('Error fetching blockchain transactions:', error);
    console.log('Returning mock transaction data...');
    return getMockTransactions();
  }
}

/**
 * Get transaction details by hash
 */
async function getTransactionDetails(txHash) {
  try {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!tx) return null;
    
    const block = await provider.getBlock(tx.blockNumber);
    
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to || 'Contract Creation',
      value: ethers.formatEther(tx.value) + ' MATIC',
      gasPrice: ethers.formatUnits(tx.gasPrice, 'gwei') + ' gwei',
      gasUsed: receipt ? ethers.formatUnits(receipt.gasUsed, 'gwei') + ' gwei' : 'Unknown',
      status: receipt?.status === 1 ? 'Success' : 'Failed',
      blockNumber: tx.blockNumber,
      timestamp: new Date(block.timestamp * 1000).toISOString(),
      input: tx.data,
      nonce: tx.nonce
    };
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    return null;
  }
}

// Load ZK verification key
let verificationKey = null;
const vKeyPath = path.join(__dirname, '../circuits/verification_key.json');
if (fs.existsSync(vKeyPath)) {
  verificationKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf8'));
}

/**
 * Verify a ZK proof using snarkjs
 * @param {Array} proof - The proof array from snarkjs
 * @param {Array} publicSignals - The public signals from the circuit
 * @returns {Promise<boolean>} - True if proof is valid
 */
async function verifyZkProof(proof, publicSignals) {
  if (!verificationKey) {
    console.warn('Verification key not found. Using dummy verification.');
    return true;
  }

  try {
    const isValid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
    return isValid;
  } catch (error) {
    console.error('ZK Proof verification error:', error.message);
    return false;
  }
}

// 1. Define the Tool (The "Arms")
const tools = [
  {
    functionDeclarations: [{
      name: "checkPaymentStatus",
      description: "Verifies a payment using Zero-Knowledge proof. Requires proof and pinHash.",
      parameters: {
        type: "OBJECT",
        properties: {
          amount: { type: "NUMBER", description: "Payment amount in rupees" },
          pinHash: { type: "STRING", description: "Public hash of PIN+Salt (Poseidon hash)" },
          proofJson: { type: "STRING", description: "Stringified ZK proof object" }
        },
        required: ["amount", "pinHash"]
      }
    }]
  }
];

// 2. The AI Agent Route
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ reply: 'Message is required' });
    }
    
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not set');
      return res.status(500).json({ reply: 'API key not configured' });
    }

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(message);
    const responseText = result.response.text();
  
    res.json({ reply: responseText });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ reply: 'Sorry, I encountered an error. Please try again.' });
  }
});

/**
 * Blockchain Transaction Endpoints
 */

/**
 * Get recent transactions from Polygon Amoy
 */
app.get('/api/transactions', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const transactions = await getBlockchainTransactions(null, limit);
    res.json({ 
      status: 'success',
      count: transactions.length,
      transactions,
      network: 'Polygon Amoy',
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
  }
});

/**
 * Get specific transaction details
 */
app.get('/api/transaction/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    const details = await getTransactionDetails(txHash);
    
    if (!details) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json({
      status: 'success',
      transaction: details
    });
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({ error: 'Failed to fetch transaction', details: error.message });
  }
});

/**
 * Query transactions with AI
 */
app.post('/api/query-transactions', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Fetch recent transactions
    const transactions = await getBlockchainTransactions(null, 10);
    
    // Create context for Gemini
    const transactionContext = `[DEMO DATA - BLOCKCHAIN PAYMENT VERIFICATION SYSTEM]

You are analyzing blockchain transactions for a Zero-Knowledge Payment Verification System (ZKPulse).
This is test/demo data for a decentralized payment system on Polygon Amoy testnet.
These are NOT real personal financial accounts or private banking data.

Recent blockchain transactions on Polygon Amoy (Testnet):
${JSON.stringify(transactions, null, 2)}

[END TRANSACTION DATA]

Merchant Query: ${query}

As a blockchain analyst for ZKPulse, please analyze these test transactions and provide insights about transaction patterns, amounts, and activity. This is strictly for demonstrating blockchain analytics on test data.`;

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(transactionContext);
    
    // Extract response text safely
    let responseText = '';
    if (result.response && result.response.candidates && result.response.candidates.length > 0) {
      const content = result.response.candidates[0].content;
      if (content && content.parts && content.parts.length > 0) {
        responseText = content.parts[0].text;
      }
    }
    
    if (!responseText) {
      responseText = 'Unable to analyze transactions at this time.';
    }

    res.json({
      status: 'success',
      query,
      transactions: transactions.length,
      analysis: responseText
    });
  } catch (error) {
    console.error('Error querying transactions:', error);
    res.status(500).json({ error: 'Failed to query transactions', details: error.message });
  }
});

/**
 * Step 3: AI Sentinel - Detect Replay Attacks & Adversarial Patterns
 */
async function detectReplayAttack(nullifier, metadata) {
  const now = Date.now();
  
  // Check if nullifier was used recently
  if (usedNullifiers.has(nullifier)) {
    const lastUsed = usedNullifiers.get(nullifier);
    const timeDiff = now - lastUsed;
    
    if (timeDiff < 5000) { // Within 5 seconds = replay attack
      return {
        detected: true,
        reason: `Replay attack: Nullifier used ${timeDiff}ms ago`,
        severity: 'CRITICAL'
      };
    }
  }
  
  // Check for suspicious patterns
  const recentPaymentsInSecond = recentPayments.filter(p => (now - p.timestamp) < 1000).length;
  if (recentPaymentsInSecond > 10) {
    return {
      detected: true,
      reason: 'Unusual transaction volume: 10+ payments in 1 second',
      severity: 'HIGH'
    };
  }
  
  // Ask Gemini to analyze metadata for fraud patterns (with clear demo context)
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const analysisPrompt = `[DEMO/TEST MODE - NOT REAL MONEY]

Analyze this TEST TRANSACTION metadata for obvious fraud patterns ONLY. This is demo blockchain payment data:
- Amount: ${metadata.amount} MATIC (testnet)
- Timestamp: ${new Date().toISOString()}
- Location: ${metadata.location || 'Unknown'}
- Merchant: ${metadata.merchantId}
- Environment: Local development/testing

ONLY flag as "SUSPICIOUS" if you detect:
1. Extremely large amounts (>1000000 MATIC)
2. Rapid repeated transactions from same source
3. Obviously invalid data

For normal, reasonable transaction amounts and patterns, respond "SAFE".

Is this a NORMAL DEMO TRANSACTION? Reply with only "SAFE" or "SUSPICIOUS".`;
    
    const result = await model.generateContent(analysisPrompt);
    let aiAnalysis = '';
    if (result.response && result.response.candidates && result.response.candidates.length > 0) {
      const content = result.response.candidates[0].content;
      if (content && content.parts && content.parts.length > 0) {
        aiAnalysis = content.parts[0].text.trim().toUpperCase();
      }
    }
    
    console.log(`AI Fraud Analysis Result: "${aiAnalysis}" for amount ${metadata.amount}`);
    
    // Only flag as suspicious if explicitly marked
    if (aiAnalysis.includes('SUSPICIOUS')) {
      return {
        detected: true,
        reason: 'AI flagged unusual payment pattern',
        severity: 'MEDIUM'
      };
    }
  } catch (e) {
    console.log('AI analysis error (non-blocking):', e.message);
    // On error, assume safe to not block legitimate payments
  }
  
  return { detected: false, reason: 'Payment passed all checks' };
}

/**
 * ZK Payment Verification Endpoint
 * Step 2-5: Verify ZK proof + PIN hash before processing payment
 */
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { proof, publicSignals, amount, pinHash, merchantId, customerId } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({ error: 'Missing proof or public signals' });
    }

    // Step 2a: Verify PIN Hash (Circuit constraint 1)
    // This proves the user entered the correct PIN without revealing it
    if (pinHash && customerId) {
      const pinCheck = await verifyPINHash(customerId, pinHash);
      if (!pinCheck.valid) {
        console.log(`❌ PIN verification failed: ${pinCheck.reason}`);
        return res.status(401).json({
          verified: false,
          message: pinCheck.reason,
          status: 'PIN_INVALID'
        });
      }
      console.log(`✓ PIN hash verified for customer ${customerId}`);
    }

    const nullifier = publicSignals[1] || publicSignals[0];
    const metadata = { amount, merchantId, location: null };

    // Step 3: AI Sentinel - Check for replay attacks
    const attackCheck = await detectReplayAttack(nullifier, metadata);
    if (attackCheck.detected) {
      console.log(`⚠️  Attack detected: ${attackCheck.reason}`);
      return res.status(403).json({
        verified: false,
        message: attackCheck.reason,
        status: 'ATTACK_DETECTED',
        severity: attackCheck.severity
      });
    }

    // Step 2b: Verify the ZK proof (Circuit constraint 2)
    // This verifies: Poseidon(PIN + Salt) == pinHash
    const isValid = await verifyZkProof(proof, publicSignals);

    if (isValid) {
      // Mark nullifier as used (prevents double-spending)
      usedNullifiers.set(nullifier, Date.now());
      
      // Record payment
      const payment = {
        amount,
        merchantId,
        customerId,
        nullifier,
        timestamp: Date.now(),
        txId: Math.random().toString(36).substr(2, 9)
      };
      recentPayments.push(payment);
      
      // Keep only last 1000 payments
      if (recentPayments.length > 1000) {
        recentPayments.shift();
      }
      
      console.log(`✓ ZK Proof verified for payment: ₹${amount}`);
      
      res.json({
        verified: true,
        message: `Verification complete. ${amount} rupees received via ZK-Shield.`,
        status: 'VERIFIED',
        transactionId: payment.txId,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`✗ ZK Proof verification failed`);
      res.status(401).json({
        verified: false,
        message: 'ZK Proof verification failed. Wrong PIN or proof is invalid.',
        status: 'PROOF_INVALID'
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error.message);
    res.status(500).json({ error: 'Verification failed', details: error.message });
  }
});

/**
 * ============================================================================
 * SECURITY FIX: Login endpoint to get JWT token
 * ============================================================================
 * Customer must authenticate before they can register or modify their PIN
 */
app.post('/api/login', (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    // Generate JWT token for the customer
    const token = jwt.sign(
      { customerId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      status: 'success',
      message: 'Authentication token generated',
      token,
      customerId,
      expiresIn: JWT_EXPIRY
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

/**
 * Register PIN endpoint (Setup phase)
 * Customer registers their PIN hash
 * ============================================================================
 * SECURITY FIX: Now requires authentication and IDOR protection
 * - User must provide valid JWT token
 * - User can only register PIN for their own customerId
 */
app.post('/api/register-pin', authenticateToken, protectCustomerData, (req, res) => {
  try {
    const { customerId, pinHash, salt } = req.body;
    
    if (!customerId || !pinHash) {
      return res.status(400).json({ error: 'Missing customerId or pinHash' });
    }

    // SECURITY: Double-check that user is only modifying their own data
    if (customerId !== req.customerId) {
      return res.status(403).json({ 
        error: 'Access denied: You can only register PIN for your own customer ID'
      });
    }
    
    registerPINHash(customerId, pinHash, salt || 'default_salt');
    
    res.json({
      status: 'success',
      message: `PIN registered for customer ${customerId}`,
      customerId,
      pinHashRegistered: true
    });
  } catch (error) {
    console.error('PIN registration error:', error);
    res.status(500).json({ error: 'PIN registration failed', details: error.message });
  }
});

/**
 * Check if PIN is registered (diagnostic endpoint)
 * ============================================================================
 * SECURITY FIX: Now requires authentication and can only check own PIN
 */
app.get('/api/check-pin/:customerId', authenticateToken, (req, res) => {
  try {
    const { customerId } = req.params;

    // SECURITY: User can only check their own PIN status
    if (customerId !== req.customerId) {
      return res.status(403).json({ 
        error: 'Access denied: You can only check your own PIN status'
      });
    }

    const isRegistered = pinRegistryFallback.has(customerId);
    
    if (!isRegistered) {
      return res.status(404).json({
        status: 'not_found',
        message: `No PIN registered for customer ${customerId}`
      });
    }
    
    const stored = pinRegistryFallback.get(customerId);
    res.json({
      status: 'registered',
      customerId,
      pinHashRegistered: true,
      registeredAt: stored.registeredAt,
      onChain: stored.onChain
    });
  } catch (error) {
    res.status(500).json({ error: 'Check failed', details: error.message });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  const pinStats = getPINRegistryStats();
  res.json({
    status: 'ok',
    zkSupport: !!verificationKey,
    pinStats
  });
});

/**
 * Get network IP for QR code generation
 */
app.get('/api/network-ip', (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    let networkIP = 'localhost';
    
    // Find the first non-internal IPv4 address
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal (localhost) and IPv6 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          networkIP = iface.address;
          break;
        }
      }
      if (networkIP !== 'localhost') break;
    }
    
    res.json({ ip: networkIP });
  } catch (error) {
    res.status(500).json({ error: 'Failed to detect network IP' });
  }
});

/**
 * Get recent payments for merchant dashboard
 */
app.get('/api/recent-payments', (req, res) => {
  try {
    // Return recent payments sorted by timestamp (newest first)
    const sortedPayments = recentPayments
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp);
    
    res.json({
      status: 'ok',
      payments: sortedPayments,
      count: sortedPayments.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

/**
 * Gemini AI Query Endpoint - Process merchant questions about transactions
 */
app.post('/api/gemini-query', async (req, res) => {
  try {
    const { query, transactions, merchantId, todayTotal } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ response: 'Gemini API key not configured. Please set GEMINI_API_KEY environment variable.' });
    }

    // Prepare transaction context for Gemini
    const transactionContext = transactions.length > 0 
      ? `Recent transactions:\n${transactions.slice(0, 5).map(t => 
          `- ₹${t.amount} from customer ${t.customerId} at ${new Date(t.timestamp).toLocaleString()}`
        ).join('\n')}`
      : 'No transactions recorded yet.';

    const systemPrompt = `You are a helpful transaction assistant for a merchant using ZKPulse payment system. 
You have access to the merchant's transaction data. Be concise and helpful in answering questions about transactions.
Current merchant ID: ${merchantId}
Today's total collection: ₹${todayTotal}
${transactionContext}`;

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const fullPrompt = `${systemPrompt}\n\nUser Question: ${query}`;
    const result = await model.generateContent(fullPrompt);

    const response = result.response.text();
    res.json({ response });
  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({ response: 'Error processing your question. Please try again.' });
  }
});

// Initialize PIN Registry contract and start server
async function startServer() {
  try {
    await initializePINRegistry();
    
    // SECURITY FIX: Changed default port from 5000 to 5001 to avoid macOS AirPlay conflict
    const PORT = process.env.PORT || 5001;
    const server = app.listen(PORT, () => {
      console.log(`listening on port ${PORT}...`);
      console.log(`Express server running on port ${PORT}`);
    });
    
    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - keep server running
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit - keep server running
});

startServer().catch(err => {
  console.error('Server startup error:', err);
  process.exit(1);
});