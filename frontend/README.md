# Smart Account Recovery Frontend

A simple React frontend for recovering smart wallet accounts using guardians.

## Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

## Features

- **Connect Wallet**: Connect your MetaMask wallet
- **Load Account Info**: View smart account details (owner, guardian, nonce)
- **Set Guardian**: If you're the account owner, set a guardian address
- **Recover Account**: If you're the guardian, recover the account to a new owner

## How It Works

### Account Architecture
- **Smart Account**: ERC-4337 compatible wallet with social recovery
- **Owner**: Current controller of the account
- **Guardian**: Trusted party who can recover the account
- **Nonce**: Prevents replay attacks during recovery

### Recovery Process
1. Guardian creates an EIP-712 signature for the recovery
2. Signature includes: current owner, new owner, and nonce
3. Smart contract verifies the guardian's signature
4. Ownership is transferred to the new owner

## Contract Addresses (Update these)

You need to update the contract addresses in `app/page.tsx`:

```typescript
// Replace with your deployed smart account address
const SMART_ACCOUNT_ADDRESS = '0x...'
```

## Usage Instructions

### For Account Owners:
1. Connect your wallet (must be the current owner)
2. Enter your smart account address
3. Load account information
4. Set a guardian address you trust

### For Guardians:
1. Connect your wallet (must be the set guardian)
2. Enter the smart account address you're guarding
3. Load account information
4. Enter the new owner address for recovery
5. Click "Recover Account" to transfer ownership

### For Viewing:
- Anyone can view account information by entering a smart account address
- Only owners can set guardians
- Only guardians can perform recovery

## Smart Contract Integration

The frontend interacts with these main functions:

- `owner()`: Get current account owner
- `guardian()`: Get set guardian address
- `getNonce(address)`: Get current nonce for replay protection
- `setGuardian(address)`: Set guardian (owner only)
- `recoverAccount(newOwner, nonce, signature)`: Recover account (guardian only)

## Security Features

- **EIP-712 Signatures**: Structured data signing for security
- **Nonce Protection**: Prevents replay attacks
- **Role-based Access**: Only owners can set guardians, only guardians can recover
- **Chain ID Verification**: Signatures are bound to specific network

## Development

The frontend is built with:
- Next.js 14
- React 18
- TypeScript
- Ethers.js v6
- Pure CSS styling

## Troubleshooting

1. **MetaMask not found**: Install MetaMask browser extension
2. **Wrong network**: Switch to localhost (chainId: 31337) for development
3. **Transaction fails**: Check if you're the correct role (owner/guardian)
4. **Contract not found**: Verify the smart account address is correct