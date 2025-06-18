# Token Swap DApp

[![Netlify Status](https://api.netlify.com/api/v1/badges/491d0c9e-0604-4309-95b7-9b39fcd4aa97/deploy-status)](https://app.netlify.com/projects/uniswap-v4-token-swap/deploys)

➡️Live demo: <https://uniswap-v4-token-swap.netlify.app/>⬅️

A decentralized application (DApp) for swapping between ETH and USDT, built with React, TypeScript, Vite, Wagmi, and RainbowKit.

USDTest (**USDT**) is a testnet token on the **Sepolia testnet**. Check the source on [Etherscan](https://sepolia.etherscan.io/address/0xbAce3798896B6e8dcBBe26B7A698150c98ba67d0).

## Description

This project provides a user interface to interact with smart contracts for token swapping functionalities on the **Sepolia test network**. Users can connect their wallets and perform swaps between Ethereum (ETH) and USDTest (USDT).
The application leverages **Uniswap's Universal Router** for efficient and flexible trade execution and utilizes **EIP-2612 `permit` signatures** for USDT token approvals, enabling a gasless approval experience for the user.

## Tech Stack

* **Framework**: React
* **Language**: TypeScript
* **Build Tool**: Vite
* **Wallet Integration**: Wagmi, Reown, RainbowKit (configured for **Sepolia Testnet**)
* **UI Library**: Chakra UI
* **Smart Contract Interaction**:
  * **Ethers.js** (via Wagmi)
  * **Uniswap V4** (for swap execution)
  * **EIP-2612 Permit Signatures** (for token approvals)

## Prerequisites

* Node.js (v20.x or later recommended)
* npm or yarn
* A modern web browser with a crypto wallet extension (e.g., MetaMask)

## Environment Variables

To run this project, you need to create a `.env` file in the root directory and add the following environment variables:

```env
# WalletConnect Project ID (get yours from https://cloud.walletconnect.com)
VITE_WALLETCONNECT_PROJECT_ID="YOUR_WALLETCONNECT_PROJECT_ID"

# USDT Token Address on the Sepolia test network
VITE_USDT_ADDRESS="YOUR_USDT_TOKEN_ADDRESS_ON_SEPOLIA"
```

Replace `"YOUR_WALLETCONNECT_PROJECT_ID"` and `"YOUR_USDT_TOKEN_ADDRESS_ON_SEPOLIA"` with your actual values. If `VITE_USDT_ADDRESS` is not set, a default demo address will be used.

## Getting Started

### Installation

1. Clone the repository (if applicable):

    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2. Install dependencies:

    ```bash
    npm install
    # or
    yarn install
    ```

3. Set up your `.env` file as described in the "Environment Variables" section.

### Running the Development Server

To start the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:5173](http://localhost:5173) (or the port shown in your terminal) to view it in your browser.

## Available Scripts

In the project directory, you can run:

* `npm run dev`: Runs the app in development mode.
* `npm run build`: Builds the app for production to the `dist` folder.
* `npm run lint`: Lints the project files using ESLint.
* `npm run preview`: Serves the production build locally for preview.

## ESLint Configuration

This project uses ESLint for code linting. The default configuration provides a minimal setup.

### Expanding the ESLint Configuration

If you are developing a production application, we recommend updating the ESLint configuration to enable type-aware linting rules for better code quality and error detection.

Modify your `eslint.config.js` (or equivalent ESLint configuration file):

```javascript
// eslint.config.js (example using typescript-eslint v6 flat config)
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // ... other configurations
  {
    // files: ['**/*.ts', '**/*.tsx'], // Ensure this targets your TS/TSX files
    extends: [
      // Remove tseslint.configs.recommended if present
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, for stricter rules:
      // ...tseslint.configs.strictTypeChecked,
      // Optionally, for stylistic rules:
      // ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'], // Adjust paths as needed
        tsconfigRootDir: import.meta.dirname, // Or your project root if not using import.meta.dirname
      },
    },
    // ... other rules or plugin configurations
  }
);
```

### React-Specific Lint Rules

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules.

After installing them (`npm install -D eslint-plugin-react-x eslint-plugin-react-dom`), update your ESLint configuration:

```javascript
// eslint.config.js
import tseslint from 'typescript-eslint';
import reactX from 'eslint-plugin-react-x';
import reactDom from 'eslint-plugin-react-dom';

export default tseslint.config(
  // ... other configurations
  {
    // files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      'react-x': reactX,
      'react-dom': reactDom,
    },
    rules: {
      // ... other rules
      ...reactX.configs['recommended-typescript'].rules,
      ...reactDom.configs.recommended.rules,
    },
    // ... other settings like languageOptions if not defined globally
  }
);
```

**Note**: The ESLint configuration examples assume you are using the new flat config format (`eslint.config.js`). If you are using the older `.eslintrc.js` or `.eslintrc.json` format, the syntax will differ. Adjust the paths in `parserOptions.project` according to your project structure.
