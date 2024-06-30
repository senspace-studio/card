import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'dotenv/config';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    local: {
      url: 'http://localhost:8545',
      timeout: 100_000,
      chainId: 1337,
      accounts: [process.env.LOCAL_PRIVATE_KEY!],
    },
    base_sepolia: {
      accounts: [process.env.TEST_PRIVATE_KEY!],
      url: 'https://base-sepolia.g.alchemy.com/v2/MYloSJq0Z0iYnAE7k36ApaRl5RfHtjlh',
    },
    base: {
      accounts: [process.env.TEST_PRIVATE_KEY!],
      url: 'https://base-mainnet.g.alchemy.com/v2/3UkpGe2fpUEY91zV9ff2Bup-Bk2RTOnY',
    },
    degen: {
      accounts: [process.env.MAIN_PRIVATE_KEY!],
      url: 'https://nitrorpc-degen-mainnet-1.t.conduit.xyz',
    },
    degen_test: {
      accounts: [process.env.TEST_PRIVATE_KEY!],
      url: 'https://nitrorpc-degen-mainnet-1.t.conduit.xyz',
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    customChains: [
      {
        network: 'base_sepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
      {
        network: 'degen',
        chainId: 666666666,
        urls: {
          apiURL: 'https://explorer.degen.tips/api',
          browserURL: 'https://explorer.degen.tips',
        },
      },
    ],
    apiKey: {
      base_sepolia: 'NFUIZFQWPD5UJ6VZ5HDHQ6M3P36Z7SJZZF',
      base: 'NFUIZFQWPD5UJ6VZ5HDHQ6M3P36Z7SJZZF',
      degen: 'abc',
    },
  },
};

export default config;
