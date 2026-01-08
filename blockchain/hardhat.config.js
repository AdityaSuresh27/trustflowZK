require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

module.exports = {
  solidity: '0.8.19',
  networks: {
    hardhat: {
      chainId: 1337
    },
    amoy: {
      url: process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002
    },
    polygonAmoy: {
      url: process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002
    },
    localhost: {
      url: 'http://127.0.0.1:8545'
    }
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY || ''
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  }
};
