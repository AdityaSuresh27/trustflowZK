#!/bin/bash
# Setup script for ZK circuit compilation
# Requires: circom 2.1.0, snarkjs 0.7.0, Node.js 18+

set -e

echo "🔧 ZK Circuit Setup - Auth.circom"
echo "=================================="

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo "❌ circom not found. Install from: https://docs.circom.io/getting-started/installation/"
    exit 1
fi

# Check if snarkjs is installed
if ! npm list snarkjs &> /dev/null; then
    echo "❌ snarkjs not found in node_modules"
    exit 1
fi

# Create circuits directory if it doesn't exist
mkdir -p circuits

echo ""
echo "📦 Step 1: Compile circuit..."
circom circuits/auth.circom --r1cs --wasm --sym -o circuits/
echo "✅ Circuit compiled"

echo ""
echo "🎲 Step 2: Start Powers of Tau ceremony (12 constraints)..."
npx snarkjs powersoftau new bn128 12 circuits/pot12_0000.ptau -v
echo "✅ Phase 1 started"

echo ""
echo "🔑 Step 3: Contribute to Powers of Tau..."
npx snarkjs powersoftau contribute circuits/pot12_0000.ptau circuits/pot12_0001.ptau --name="ZKPulse Contribution" -v
echo "✅ Contribution added"

echo ""
echo "🎯 Step 4: Prepare Phase 2..."
npx snarkjs powersoftau prepare phase2 circuits/pot12_0001.ptau circuits/pot12_final.ptau -v
echo "✅ Phase 2 prepared"

echo ""
echo "⚙️ Step 5: Setup Groth16 proof system..."
npx snarkjs groth16 setup circuits/auth.r1cs circuits/pot12_final.ptau circuits/auth_0000.zkey
echo "✅ Groth16 setup complete"

echo ""
echo "🔐 Step 6: Export verification key..."
npx snarkjs zkey export verificationkey circuits/auth_0000.zkey circuits/verification_key.json
echo "✅ Verification key exported"

echo ""
echo "📜 Step 7: Export Solidity verifier..."
npx snarkjs zkey export solidityverifier circuits/auth_0000.zkey blockchain/contracts/Verifier.sol
echo "✅ Solidity verifier exported"

echo ""
echo "=================================="
echo "✨ Setup Complete!"
echo ""
echo "Generated files:"
echo "  - circuits/auth.r1cs"
echo "  - circuits/auth.wasm"
echo "  - circuits/auth.sym"
echo "  - circuits/auth_0000.zkey"
echo "  - circuits/verification_key.json (backend uses this)"
echo "  - blockchain/contracts/Verifier.sol (on-chain verification)"
echo ""
echo "Next steps:"
echo "  1. Commit all changes"
echo "  2. Install blockchain dependencies: cd blockchain && npm install"
echo "  3. Deploy contracts: npm run deploy:amoy"
echo "  4. Test backend endpoint: curl -X POST http://localhost:5000/api/verify-payment"
