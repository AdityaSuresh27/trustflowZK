/**
 * Test Data Generator for ZK Payment Verification
 * Generates sample proofs, pins, and salts for testing
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const CIRCUITS_DIR = path.join(__dirname, '..', 'circuits');

/**
 * Generate test data with a real proof (requires circuit to be compiled)
 */
async function generateTestData() {
  console.log('\n🔐 Generating Test Data for ZK Proofs');
  console.log('=====================================\n');

  // Check if circuit is compiled
  const zkeyPath = path.join(CIRCUITS_DIR, 'auth_0000.zkey');
  const wasmPath = path.join(CIRCUITS_DIR, 'auth_js', 'auth.wasm');

  if (!fs.existsSync(zkeyPath) || !fs.existsSync(wasmPath)) {
    console.log('⚠️  Circuit not compiled yet.');
    console.log('\nTo generate real proofs:');
    console.log('  1. cd circuits');
    console.log('  2. ./setup.sh (or setup.bat on Windows)');
    console.log('\nGenerating mock test data instead...\n');

    return generateMockTestData();
  }

  try {
    // Generate multiple test cases with different PINs and salts
    const testCases = [
      { name: 'User 1', pin: '1234', salt: '5678' },
      { name: 'User 2', pin: '9876', salt: '5432' },
      { name: 'User 3', pin: '1111', salt: '2222' }
    ];

    const proofs = [];

    for (const testCase of testCases) {
      console.log(`Generating proof for ${testCase.name}...`);

      try {
        // Calculate witness
        const witness = await snarkjs.wtns.calculate(
          { pin: testCase.pin, salt: testCase.salt },
          wasmPath
        );

        // Generate proof
        const { proof, publicSignals } = await snarkjs.groth16.prove(
          zkeyPath,
          witness
        );

        proofs.push({
          user: testCase.name,
          pin: testCase.pin,
          salt: testCase.salt,
          pinHash: publicSignals[0],
          proof: {
            pi_a: proof.pi_a,
            pi_b: proof.pi_b,
            pi_c: proof.pi_c,
            protocol: proof.protocol,
            curve: proof.curve
          },
          publicSignals
        });

        console.log(`  ✓ Proof generated`);
        console.log(`    PIN Hash: ${publicSignals[0].slice(0, 16)}...`);
      } catch (error) {
        console.error(`  ✗ Failed to generate proof: ${error.message}`);
      }
    }

    // Save test data
    const testDataPath = path.join(__dirname, 'test-data.json');
    fs.writeFileSync(testDataPath, JSON.stringify(proofs, null, 2));
    console.log(`\n✅ Test data saved to: tests/test-data.json`);

    return proofs;
  } catch (error) {
    console.error('\n❌ Error generating test data:', error.message);
    return generateMockTestData();
  }
}

/**
 * Generate mock test data (no circuit required)
 */
function generateMockTestData() {
  console.log('Generating mock test data...\n');

  const mockProofs = [
    {
      user: 'User 1',
      pin: '1234',
      salt: '5678',
      pinHash: '12345678901234567890123456789012',
      proof: {
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
      },
      publicSignals: ['12345678901234567890123456789012']
    },
    {
      user: 'User 2',
      pin: '9876',
      salt: '5432',
      pinHash: '98765432109876543210987654321098',
      proof: {
        pi_a: [
          '20000000000000000000000000000000000000000000000000000000000000000',
          '15000000000000000000000000000000000000000000000000000000000000000',
          '1'
        ],
        pi_b: [
          [
            '10000000000000000000000000000000000000000000000000000000000000000',
            '12000000000000000000000000000000000000000000000000000000000000000'
          ],
          [
            '18000000000000000000000000000000000000000000000000000000000000000',
            '19000000000000000000000000000000000000000000000000000000000000000'
          ],
          ['1', '0']
        ],
        pi_c: [
          '20000000000000000000000000000000000000000000000000000000000000000',
          '15000000000000000000000000000000000000000000000000000000000000000',
          '1'
        ],
        protocol: 'groth16',
        curve: 'bn128'
      },
      publicSignals: ['98765432109876543210987654321098']
    }
  ];

  const testDataPath = path.join(__dirname, 'test-data.json');
  fs.writeFileSync(testDataPath, JSON.stringify(mockProofs, null, 2));
  console.log('✅ Mock test data saved to: tests/test-data.json');
  console.log('\n📝 Note: These are mock proofs. Real proofs require circuit compilation.');

  return mockProofs;
}

/**
 * Load test data from file
 */
function loadTestData() {
  const testDataPath = path.join(__dirname, 'test-data.json');
  if (fs.existsSync(testDataPath)) {
    const data = fs.readFileSync(testDataPath, 'utf8');
    return JSON.parse(data);
  }
  return null;
}

/**
 * Get a specific test proof by user name
 */
function getTestProof(userName) {
  const data = loadTestData();
  if (!data) {
    console.warn('Test data not found. Run generateTestData() first.');
    return null;
  }
  return data.find(p => p.user === userName);
}

// Run if executed directly
if (require.main === module) {
  generateTestData().then(proofs => {
    console.log('\n📊 Generated Proofs:');
    proofs.forEach(p => {
      console.log(`  - ${p.user}: PIN ${p.pin}, Hash ${p.pinHash.slice(0, 16)}...`);
    });
  });
}

module.exports = {
  generateTestData,
  generateMockTestData,
  loadTestData,
  getTestProof
};
