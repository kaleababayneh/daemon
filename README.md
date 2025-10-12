# ZK Smart Account Recovery System

A comprehensive zero-knowledge smart account recovery system built on Linea(Ethereum), leveraging ZK-SNARKs for privacy-preserving social recovery. This project enables secure account recovery through guardian verification without revealing sensitive information on-chain.

## 🏗️ Architecture Overview

This system consists of four main components:

1. **Smart Contracts** - Account abstraction infrastructure with ZK proof verification
2. **ZK Circuits** - Noir circuits for privacy-preserving recovery proofs
3. **Frontend Interface** - React/Next.js web application for user interactions
4. **ZK Scripts** - Utilities for proof generation and contract deployment

## 🔧 Core Features

### 🔐 Zero-Knowledge Recovery
- **Privacy-Preserving**: Guardian verification without revealing secrets on-chain
- **Cryptographic Security**: Uses Poseidon2 hash function and ZK-SNARKs
- **Nullifier System**: Prevents replay attacks with unique nullifiers

### 🏦 Account Abstraction
- **ERC-4337 Compatible**: Implements EntryPoint and UserOperation standards
- **Gasless Transactions**: Optional paymaster integration for sponsored transactions
- **Smart Account Management**: Complete ownership transfer capabilities

### 🛡️ Guardian System
- **Commitment-Based**: Guardians commit to secret answers for recovery
- **Multi-Guardian Support**: Extensible architecture for multiple guardians
- **Secure Recovery**: ZK proofs validate guardian authorization

## 📁 Project Structure

```
daemon/
├── contracts/              # Smart contract implementations
│   ├── SmartAccount.sol    # Main account abstraction contract
│   ├── SocialRecovery.sol  # ZK recovery verification
│   ├── Verifier.sol        # Generated ZK proof verifier
│   ├── EntryPoint.sol      # ERC-4337 entry point
│   └── poseidon/           # Poseidon hash library
├── circuits/               # ZK circuit implementations
│   ├── src/main.nr         # Main recovery circuit
│   └── target/             # Compiled circuit artifacts
├── frontend/               # React/Next.js web interface
│   ├── app/                # Next.js app router
│   ├── public/             # Static assets
│   └── utils/              # Frontend utilities
├── zk-scripts/             # Deployment and utility scripts
│   ├── deploy.ts           # Contract deployment
│   ├── execute.ts          # Smart account creation
│   └── generateRecoveryHashandProof.ts  # ZK proof generation
└── package.json            # Project dependencies
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Rust and Cargo (for Noir circuits)
- Nargo (Noir toolkit)
- MetaMask or compatible Web3 wallet

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd daemon
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd frontend && npm install
   ```

3. **Install Noir and Nargo**
   ```bash
   # Install Nargo
   curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
   noirup
   ```

4. **Environment Setup**
   ```bash
   cp .env.example .env
   # Configure your environment variables
   ```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Network Configuration
PRIVATE_KEY=your_private_key_here
LINEA_SEPOLIA_RPC=https://rpc.sepolia.linea.build
ETHERSCAN_API_KEY=your_etherscan_api_key

# Contract Addresses (will be populated after deployment)
SMART_ACCOUNT_FACTORY=
SOCIAL_RECOVERY=
VERIFIER=
ERC20_MOCK=
ENTRY_POINT=
```

## 🔨 Development Workflow

### 1. Circuit Development

Navigate to the circuits directory and work with Noir:

```bash
cd circuits

# Compile the circuit
nargo build

# Run tests
nargo test

# Generate verification key
nargo codegen-verifier
```

### 2. Smart Contract Development

Compile and deploy contracts:

```bash
# Compile contracts
npx hardhat compile

# Deploy to Linea Sepolia
npx hardhat run zk-scripts/deploy.ts --network lineaSepolia

# Create a smart account
npx hardhat run zk-scripts/execute.ts --network lineaSepolia
```

### 3. Frontend Development

Start the development server:

```bash
cd frontend
npm run dev
```

Access the application at `http://localhost:3000`

## 🔐 ZK Circuit Explanation

The core ZK circuit (`circuits/src/main.nr`) implements the recovery verification logic:

### Input Parameters

**Public Inputs:**
- `nullifier_hash`: Unique identifier preventing replay attacks
- `guardians_commitment`: Guardian's commitment to secret answer
- `new_owner`: Address that will become the new account owner
- `current_owner`: Current account owner address

**Private Inputs:**
- `secret_answer`: Guardian's secret answer for recovery
- `secret_key`: Guardian's private key for commitment

### Circuit Logic

1. **Commitment Verification**: Validates that the guardian has the correct secret
   ```noir
   let commitment = Poseidon2::hash([secret_key, secret_answer], 2);
   ```

2. **Nullifier Generation**: Creates unique nullifier for this recovery attempt
   ```noir
   let computed_nullifier_hash = Poseidon2::hash([
       secret_key, 
       Poseidon2::hash([secret_answer], 1),
       new_owner,     
       current_owner   
   ], 4);
   ```

3. **Proof Verification**: Ensures all conditions are met before allowing recovery

## 🌐 Smart Contract Architecture

### SmartAccount.sol
- **Purpose**: Main account contract implementing ERC-4337
- **Features**: 
  - Execute transactions
  - Ownership management
  - Recovery integration
  - Gas optimization

### SocialRecovery.sol
- **Purpose**: Handles ZK proof verification for recovery
- **Features**:
  - Guardian management
  - Nullifier tracking
  - Proof validation
  - Ownership transfer

### Verifier.sol
- **Purpose**: Auto-generated ZK proof verifier
- **Features**:
  - Groth16 proof verification
  - Circuit-specific validation
  - Gas-optimized verification

## 🎯 Usage Guide

### For Account Owners

1. **Setup Account**: Deploy a smart account through the frontend
2. **Add Guardians**: Set up guardians with their commitments
3. **Fund Account**: Transfer tokens to your smart account
4. **Normal Operations**: Use the account for regular transactions

### For Guardians

1. **Receive Commitment**: Get commitment details from account owner
2. **Store Secrets**: Securely store your secret key and answer
3. **Recovery Process**: Generate ZK proof when recovery is needed

### Recovery Process

1. **Generate Proof**: Guardian creates ZK proof with new owner address
2. **Submit Recovery**: Submit proof and recovery data through frontend
3. **Verification**: Contract verifies ZK proof and transfers ownership
4. **Completion**: New owner gains control of the smart account

## 📊 Live Deployment - Linea Sepolia

The system is deployed on Linea Sepolia testnet:

```
Network: Linea Sepolia (Chain ID: 59141)
RPC: https://rpc.sepolia.linea.build

Contract Addresses:
- EntryPoint: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
- SmartAccountFactory: 0x6Ac2267c3117faA7368ACDcda7CF87B915995339
- SocialRecovery: 0x1F1065e9b9Db6e6CD4Fd5aB2a950Fef996c7db52
- Verifier: 0x3d59D92e00F4719d8ce6B166a3b132e61ade2C38
- ERC20Mock: 0xC8Dd6e5b00d39a2B5DbEF4e6D9Bc6b7A3C49A8e6

Example Smart Account: 0xeAedBDD949FD14CE86fA9B16D833075e0c3D2DfF
```

## 🧪 Testing

### Circuit Testing
```bash
cd circuits
nargo test
```

### Contract Testing
```bash
npx hardhat test
```

### Integration Testing
```bash
# Deploy contracts
npx hardhat run zk-scripts/deploy.ts --network lineaSepolia

# Create smart account
npx hardhat run zk-scripts/execute.ts --network lineaSepolia

# Generate recovery proof
cd zk-scripts
npx tsx generateRecoveryHashandProof.ts

# Test recovery on frontend
cd ../frontend
npm run dev
```

## 🔒 Security Considerations

### Cryptographic Security
- **Hash Function**: Uses Poseidon2 for ZK-friendly hashing
- **Proof System**: Groth16 ZK-SNARKs for efficient verification
- **Nullifiers**: Prevents double-spending and replay attacks

### Smart Contract Security
- **Access Control**: Role-based permissions and ownership checks
- **Reentrancy Protection**: SafeERC20 and ReentrancyGuard patterns
- **Gas Optimization**: Efficient proof verification and storage

### Guardian Security
- **Secret Management**: Guardians must securely store private keys
- **Commitment Scheme**: Cryptographic commitments prevent manipulation
- **Recovery Timing**: Consider implementing time delays for security

## 🛠️ Development Tools

### Required Tools
- **Hardhat**: Ethereum development environment
- **Nargo**: Noir circuit compiler and package manager
- **TypeScript**: Type-safe development
- **Next.js**: React framework for frontend
- **ethers.js**: Ethereum library for contract interaction

### Optional Tools
- **Foundry**: Alternative Ethereum toolkit
- **Metamask**: Browser wallet for testing
- **Remix**: Online Solidity IDE
- **Hardhat Dashboard**: Transaction management

## 📚 Technical References

### ZK-SNARKs and Noir
- [Noir Documentation](https://noir-lang.org/)
- [Aztec Protocol](https://aztec.network/)
- [ZK-SNARKs Explained](https://blog.ethereum.org/2016/12/05/zksnarks-in-a-nutshell/)

### Account Abstraction
- [ERC-4337 Standard](https://eips.ethereum.org/EIPS/eip-4337)
- [Account Abstraction Guide](https://ethereum.org/en/roadmap/account-abstraction/)
- [EntryPoint Contract](https://github.com/eth-infinitism/account-abstraction)

### Cryptographic Primitives
- [Poseidon Hash Function](https://www.poseidon-hash.info/)
- [Commitment Schemes](https://en.wikipedia.org/wiki/Commitment_scheme)
- [Nullifier Systems](https://github.com/semaphore-protocol/semaphore)

## 🚨 Troubleshooting

### Common Issues

1. **Circuit Compilation Errors**
   ```bash
   # Ensure Nargo is installed correctly
   nargo --version
   
   # Clean and rebuild
   nargo clean
   nargo build
   ```

2. **Contract Deployment Failures**
   ```bash
   # Check network configuration
   npx hardhat verify --network lineaSepolia [contract-address]
   
   # Verify gas settings
   npx hardhat run zk-scripts/deploy.ts --network lineaSepolia
   ```

3. **Frontend Connection Issues**
   ```bash
   # Check MetaMask network
   # Verify contract addresses in config.ts
   # Ensure RPC endpoint is accessible
   ```

4. **ZK Proof Generation Errors**
   ```bash
   # Verify circuit compilation
   cd circuits && nargo build
   
   # Check input format
   cd zk-scripts && npx tsx generateRecoveryHashandProof.ts
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript/Solidity best practices
- Add tests for new features
- Update documentation for API changes
- Ensure ZK circuits compile successfully

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Noir Lang Team** for the ZK circuit framework
- **Ethereum Foundation** for ERC-4337 standards
- **Aztec Protocol** for ZK cryptographic tools
- **OpenZeppelin** for secure smart contract libraries

## 📞 Support

For questions and support:
- Create an issue in the GitHub repository
- Join the community discussions
- Review the documentation and examples

---

**⚠️ Disclaimer**: This is experimental software. Use at your own risk in production environments. Always conduct thorough security audits before deploying to mainnet.
