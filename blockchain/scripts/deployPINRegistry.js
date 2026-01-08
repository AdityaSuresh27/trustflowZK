const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying PINRegistry to Polygon Amoy...\n");
  
  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`📝 Deploying from account: ${deployer.address}`);
  
  // Check balance using provider
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${hre.ethers.formatEther(balance)} MATIC\n`);
  
  if (balance === 0n) {
    console.error("❌ Insufficient balance! Get testnet MATIC from: https://faucet.polygon.technology/");
    process.exit(1);
  }
  
  // Deploy contract
  const PINRegistry = await hre.ethers.getContractFactory("PINRegistry");
  const pinRegistry = await PINRegistry.deploy();
  
  await pinRegistry.waitForDeployment();
  
  const address = await pinRegistry.getAddress();
  console.log("✅ PINRegistry deployed successfully!");
  console.log(`📍 Contract address: ${address}\n`);
  
  // Save address to .env
  const fs = require('fs');
  const path = require('path');
  
  const backendEnvPath = path.join(__dirname, '../backend/.env');
  
  // Read existing .env
  let envContent = '';
  if (fs.existsSync(backendEnvPath)) {
    envContent = fs.readFileSync(backendEnvPath, 'utf-8');
  }
  
  // Remove old PIN_REGISTRY_ADDRESS if exists
  envContent = envContent.replace(/PIN_REGISTRY_ADDRESS=.*/g, '');
  
  // Add new address
  if (!envContent.endsWith('\n')) {
    envContent += '\n';
  }
  envContent += `PIN_REGISTRY_ADDRESS=${address}\n`;
  
  fs.writeFileSync(backendEnvPath, envContent);
  console.log(`✅ Updated backend/.env with contract address\n`);
  
  // Print usage instructions
  console.log("🎉 Next steps:");
  console.log("1. Restart the backend server");
  console.log("2. The system will now use blockchain storage for PINs");
  console.log("3. Test with: curl http://localhost:5000/api/health\n");
  
  console.log("📋 Contract Details:");
  console.log(`   Network: Polygon Amoy Testnet`);
  console.log(`   Address: ${address}`);
  console.log(`   Explorer: https://amoy.polygonscan.com/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
