# ZK Circuit Documentation

## Overview

This directory contains the Circom Zero-Knowledge circuit for the ZKPulse payment verification system. The `auth.circom` circuit proves knowledge of a valid PIN without revealing it, using Poseidon hashing for privacy.

## Circuit Structure

### `auth.circom`
- **Inputs (Private)**:
  - `pin`: User's PIN (256-bit)
  - `salt`: Random salt for hashing (256-bit)

- **Outputs (Public)**:
  - `pinHash`: Poseidon hash of PIN + Salt

- **Logic**:
  ```
  pinHash = Poseidon(pin, salt)
  ```

The circuit proves that the prover knows a PIN and salt that hash to a specific pinHash value, without revealing either the PIN or salt.

## Setup Instructions

### Prerequisites

1. **Circom Compiler** (v2.1.0+)
   ```bash
   # macOS
   brew install circom
   
   # Linux / Windows (see: https://docs.circom.io/getting-started/installation/)
   ```

2. **Node.js** (v18+) - Already installed in backend

3. **snarkjs** (v0.7.0+) - Already in backend/package.json

### Quick Start

#### Option 1: Windows Users
```bash
cd circuits
setup.bat
```

#### Option 2: Unix/Linux/macOS Users
```bash
cd circuits
chmod +x setup.sh
./setup.sh
```

#### Option 3: Manual Setup

**Step 1: Compile the circuit**
```bash
circom circuits/auth.circom --r1cs --wasm --sym -o circuits/
```

**Step 2: Start Powers of Tau ceremony (trusted setup)**
```bash
# Create initial ptau file (12 = 2^12 constraints)
npx snarkjs powersoftau new bn128 12 circuits/pot12_0000.ptau -v

# Contribute randomness (anyone can do this multiple times)
npx snarkjs powersoftau contribute circuits/pot12_0000.ptau circuits/pot12_0001.ptau --name="Contribution 1" -v

# Prepare for phase 2
npx snarkjs powersoftau prepare phase2 circuits/pot12_0001.ptau circuits/pot12_final.ptau -v
```

**Step 3: Generate proof system (Groth16)**
```bash
npx snarkjs groth16 setup circuits/auth.r1cs circuits/pot12_final.ptau circuits/auth_0000.zkey
```

**Step 4: Export verification key**
```bash
npx snarkjs zkey export verificationkey circuits/auth_0000.zkey circuits/verification_key.json
```

**Step 5: Export Solidity verifier contract**
```bash
npx snarkjs zkey export solidityverifier circuits/auth_0000.zkey ../blockchain/contracts/Verifier.sol
```

## Generated Files

After setup, you'll have:

| File | Purpose |
|------|---------|
| `auth.r1cs` | Rank-1 Constraint System (circuit constraints) |
| `auth.wasm` | WebAssembly for witness generation |
| `auth.sym` | Symbol file for debugging |
| `auth_0000.zkey` | Proving key (secret, delete after deployment) |
| `verification_key.json` | Verification key (public, used by backend) |
| `pot12_*.ptau` | Powers of Tau ceremony files (can be deleted after setup) |

## Proof Generation

Once the circuit is compiled, generate proofs:

```javascript
// Using the generated WASM and proving key
const snarkjs = require('snarkjs');
const fs = require('fs');

const pin = 1234;
const salt = 5678;

// Calculate witness
const witness = await snarkjs.wtns.calculate(
  { pin, salt },
  'circuits/auth_js/auth.wasm'
);

// Generate proof
const { proof, publicSignals } = await snarkjs.groth16.prove(
  'circuits/auth_0000.zkey',
  witness
);

// Verify proof (optional, for testing)
const verificationKey = JSON.parse(fs.readFileSync('circuits/verification_key.json'));
const isValid = await snarkjs.groth16.verify(
  verificationKey,
  publicSignals,
  proof
);

console.log('Proof valid:', isValid);
```

## Integration with Backend

The backend loads `verification_key.json` and exposes `/api/verify-payment`:

```bash
POST /api/verify-payment
Content-Type: application/json

{
  "proof": { pi_a, pi_b, pi_c, protocol, curve },
  "publicSignals": [pinHash],
  "amount": 100
}
```

## Security Considerations

1. **Delete the proving key after setup**: The `auth_0000.zkey` file contains the secret proving key. Delete it after deployment.

2. **Powers of Tau**: In production, use ceremony results from established trusted setups (e.g., Ethereum's ceremony).

3. **Poseidon Hash**: The implementation uses circomlib's Poseidon(2), which is SCA-resistant.

4. **Witness Privacy**: Proofs are zero-knowledge - verifiers cannot extract PIN or salt from the proof.

## Troubleshooting

### "circom: command not found"
- Install circom: https://docs.circom.io/getting-started/installation/

### "snarkjs not found"
- Install in backend: `cd backend && npm install snarkjs`

### "WASM compilation failed"
- Check circom syntax in `auth.circom`
- Run with verbose flag: `circom ... --verbose`

### "Verification key mismatch"
- Ensure `verification_key.json` matches the zkey used for proof generation
- Regenerate if you rebuild the circuit

## Testing

Test the circuit locally:

```bash
# Generate test inputs
node -e "
const snarkjs = require('snarkjs');
const fs = require('fs');

const input = { pin: 1234, salt: 5678 };
console.log('Input:', input);
"
```

## References

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs GitHub](https://github.com/iden3/snarkjs)
- [Poseidon Hash](https://www.poseidon-hash.info/)
- [Groth16 Proofs](https://eprint.iacr.org/2016/260.pdf)
