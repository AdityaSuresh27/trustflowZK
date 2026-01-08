@echo off
REM Setup script for ZK circuit compilation (Windows)
REM Requires: circom 2.1.0, snarkjs 0.7.0, Node.js 18+

setlocal enabledelayedexpansion

echo.
echo 🔧 ZK Circuit Setup - Auth.circom
echo ==================================

REM Check if circom is installed
where circom >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ circom not found. Install from: https://docs.circom.io/getting-started/installation/
    exit /b 1
)

REM Check if snarkjs is installed
npm list snarkjs >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ snarkjs not found in node_modules
    exit /b 1
)

REM Create circuits directory if it doesn't exist
if not exist circuits mkdir circuits

echo.
echo 📦 Step 1: Compile circuit...
circom circuits\auth.circom --r1cs --wasm --sym -o circuits\
if %ERRORLEVEL% NEQ 0 goto :error
echo ✅ Circuit compiled

echo.
echo 🎲 Step 2: Start Powers of Tau ceremony (12 constraints)...
call npx snarkjs powersoftau new bn128 12 circuits\pot12_0000.ptau -v
if %ERRORLEVEL% NEQ 0 goto :error
echo ✅ Phase 1 started

echo.
echo 🔑 Step 3: Contribute to Powers of Tau...
call npx snarkjs powersoftau contribute circuits\pot12_0000.ptau circuits\pot12_0001.ptau --name="ZKPulse Contribution" -v
if %ERRORLEVEL% NEQ 0 goto :error
echo ✅ Contribution added

echo.
echo 🎯 Step 4: Prepare Phase 2...
call npx snarkjs powersoftau prepare phase2 circuits\pot12_0001.ptau circuits\pot12_final.ptau -v
if %ERRORLEVEL% NEQ 0 goto :error
echo ✅ Phase 2 prepared

echo.
echo ⚙️ Step 5: Setup Groth16 proof system...
call npx snarkjs groth16 setup circuits\auth.r1cs circuits\pot12_final.ptau circuits\auth_0000.zkey
if %ERRORLEVEL% NEQ 0 goto :error
echo ✅ Groth16 setup complete

echo.
echo 🔐 Step 6: Export verification key...
call npx snarkjs zkey export verificationkey circuits\auth_0000.zkey circuits\verification_key.json
if %ERRORLEVEL% NEQ 0 goto :error
echo ✅ Verification key exported

echo.
echo 📜 Step 7: Export Solidity verifier...
call npx snarkjs zkey export solidityverifier circuits\auth_0000.zkey blockchain\contracts\Verifier.sol
if %ERRORLEVEL% NEQ 0 goto :error
echo ✅ Solidity verifier exported

echo.
echo ==================================
echo ✨ Setup Complete!
echo.
echo Generated files:
echo   - circuits\auth.r1cs
echo   - circuits\auth.wasm
echo   - circuits\auth.sym
echo   - circuits\auth_0000.zkey
echo   - circuits\verification_key.json (backend uses this)
echo   - blockchain\contracts\Verifier.sol (on-chain verification)
echo.
echo Next steps:
echo   1. Commit all changes
echo   2. Install blockchain dependencies: cd blockchain ^&^& npm install
echo   3. Deploy contracts: npm run deploy:amoy
echo   4. Test backend endpoint: curl -X POST http://localhost:5000/api/verify-payment
goto :end

:error
echo.
echo ❌ Setup failed at step !ERRORLEVEL!
exit /b 1

:end
endlocal
