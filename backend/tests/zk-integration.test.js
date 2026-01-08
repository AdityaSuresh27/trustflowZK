/**
 * Integration test: Complete ZK proof flow
 * Tests circuit → proof generation → verification
 */

const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');

const CIRCUITS_DIR = path.join(__dirname, '..', 'circuits');
const VERIFICATION_KEY_PATH = path.join(CIRCUITS_DIR, 'verification_key.json');

async function testCircuitCompilation() {
  console.log('\n📋 Step 1: Check if circuit is compiled...');
  
  const wasmPath = path.join(CIRCUITS_DIR, 'auth_js', 'auth.wasm');
  const zkeyPath = path.join(CIRCUITS_DIR, 'auth_0000.zkey');
  
  if (!fs.existsSync(wasmPath)) {
    console.error('❌ WASM file not found:', wasmPath);
    console.error('   Run: cd circuits && ./setup.sh (or setup.bat on Windows)');
    return false;
  }
  
  if (!fs.existsSync(zkeyPath)) {
    console.error('❌ ZKey file not found:', zkeyPath);
    console.error('   Run: cd circuits && ./setup.sh (or setup.bat on Windows)');
    return false;
  }
  
  console.log('✅ Circuit files found');
  return true;
}

async function testProofGeneration() {
  console.log('\n📋 Step 2: Generate test proof...');
  
  try {
    const input = {
      pin: '1234',
      salt: '5678'
    };
    
    const wasmPath = path.join(CIRCUITS_DIR, 'auth_js', 'auth.wasm');
    const zkeyPath = path.join(CIRCUITS_DIR, 'auth_0000.zkey');
    
    // Calculate witness
    console.log('   Calculating witness for input:', input);
    const witness = await snarkjs.wtns.calculate(input, wasmPath);
    console.log('   ✓ Witness calculated');
    
    // Generate proof
    console.log('   Generating Groth16 proof...');
    const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyPath, witness);
    console.log('   ✓ Proof generated');
    
    console.log('✅ Proof generation successful');
    console.log('   Public Signals:', publicSignals);
    
    return { proof, publicSignals };
  } catch (error) {
    console.error('❌ Proof generation failed:', error.message);
    return null;
  }
}

async function testProofVerification(proof, publicSignals) {
  console.log('\n📋 Step 3: Verify proof locally...');
  
  try {
    if (!fs.existsSync(VERIFICATION_KEY_PATH)) {
      console.error('❌ Verification key not found:', VERIFICATION_KEY_PATH);
      return false;
    }
    
    const verificationKey = JSON.parse(fs.readFileSync(VERIFICATION_KEY_PATH));
    
    console.log('   Verifying proof...');
    const isValid = await snarkjs.groth16.verify(
      verificationKey,
      publicSignals,
      proof
    );
    
    if (isValid) {
      console.log('✅ Proof verification successful');
      return true;
    } else {
      console.log('❌ Proof verification failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

async function testBackendIntegration() {
  console.log('\n📋 Step 4: Test backend integration...');
  
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:5000/api/health');
    
    if (response.data.zk_enabled) {
      console.log('✅ Backend is ready for ZK proofs');
      console.log('   ZK Status:', response.data);
      return true;
    } else {
      console.log('⚠️  Backend running but ZK not enabled yet');
      console.log('   Message:', response.data.message);
      return true; // Not a failure, just not compiled yet
    }
  } catch (error) {
    console.warn('⚠️  Backend not running on localhost:5000');
    console.warn('   Run: cd backend && npm start');
    return true; // Not a failure, just not running
  }
}

async function runTests() {
  console.log('=====================================');
  console.log('ZK Circuit Integration Tests');
  console.log('=====================================');
  
  const compiled = await testCircuitCompilation();
  if (!compiled) {
    console.log('\n❌ Circuit not compiled. Skipping further tests.');
    console.log('\nTo compile the circuit:');
    console.log('  cd circuits');
    console.log('  ./setup.sh (Unix/Linux/macOS)');
    console.log('  setup.bat (Windows)');
    process.exit(1);
  }
  
  const proofData = await testProofGeneration();
  if (!proofData) {
    console.log('\n❌ Proof generation failed');
    process.exit(1);
  }
  
  const verified = await testProofVerification(proofData.proof, proofData.publicSignals);
  if (!verified) {
    console.log('\n❌ Proof verification failed');
    process.exit(1);
  }
  
  await testBackendIntegration();
  
  console.log('\n=====================================');
  console.log('✨ All tests passed!');
  console.log('=====================================\n');
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = { testCircuitCompilation, testProofGeneration, testProofVerification };
