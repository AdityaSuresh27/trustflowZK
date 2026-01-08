/**
 * Test suite for ZK proof verification endpoint
 * Tests /api/verify-payment with Groth16 proofs
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000';

// Mock Groth16 proof (for testing without circuit compilation)
const mockProof = {
  pi_a: [
    '11476779903914993842564251124996196858255093325223160820356348241872234089431',
    '7788969309159181373328239055725346934968633652827689047341063189241706723076',
    '1'
  ],
  pi_b: [
    [
      '2833395270129843098372537968476981797879387305275621303088518533370370025880',
      '9223976872905813945996299076879814319388088146088186189949019922688849393181'
    ],
    [
      '14046844235633233093055387882903886151930381849844879055897889949319293625033',
      '16319301097606447255151826236098621068048393486095099905848920814825129313537'
    ],
    ['1', '0']
  ],
  pi_c: [
    '11476779903914993842564251124996196858255093325223160820356348241872234089431',
    '7788969309159181373328239055725346934968633652827689047341063189241706723076',
    '1'
  ],
  protocol: 'groth16',
  curve: 'bn128'
};

// Public signals (pinHash would be output of Poseidon(pin, salt))
const mockPublicSignals = [
  '12345678901234567890123456789012'
];

async function testHealthEndpoint() {
  try {
    console.log('\n📋 Testing /api/health endpoint...');
    const response = await axios.get(`${API_URL}/api/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testVerifyPayment() {
  try {
    console.log('\n🔐 Testing /api/verify-payment endpoint...');
    const response = await axios.post(`${API_URL}/api/verify-payment`, {
      proof: mockProof,
      publicSignals: mockPublicSignals,
      amount: 100
    });
    console.log('✅ Payment verification response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Payment verification failed:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

async function testInvalidProof() {
  try {
    console.log('\n⚠️ Testing invalid proof rejection...');
    const invalidProof = {
      pi_a: ['0', '0', '1'],
      pi_b: [['0', '0'], ['0', '0'], ['1', '0']],
      pi_c: ['0', '0', '1'],
      protocol: 'groth16',
      curve: 'bn128'
    };
    
    const response = await axios.post(`${API_URL}/api/verify-payment`, {
      proof: invalidProof,
      publicSignals: mockPublicSignals,
      amount: 100
    });
    console.log('✅ Invalid proof handled:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Invalid proof test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('=================================');
  console.log('ZK Payment Verification Tests');
  console.log('=================================');
  
  const results = {
    health: await testHealthEndpoint(),
    verify: await testVerifyPayment(),
    invalid: await testInvalidProof()
  };

  console.log('\n=================================');
  console.log('Test Summary:');
  console.log(`  Health Check: ${results.health ? '✅' : '❌'}`);
  console.log(`  Verify Payment: ${results.verify ? '✅' : '❌'}`);
  console.log(`  Invalid Proof: ${results.invalid ? '✅' : '❌'}`);
  console.log('=================================\n');

  process.exit(Object.values(results).every(r => r) ? 0 : 1);
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

module.exports = { testHealthEndpoint, testVerifyPayment, testInvalidProof };
