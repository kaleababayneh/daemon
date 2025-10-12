Privacy Preserving Social Account Recovery

proof generation commands

nargo compile

bb write_vk --oracle_hash keccak -b ./target/circuits.json -o ./target

bb write_solidity_verifier -k ./target/vk -o ./target/Verifier.sol

deploy contracts & frontend

npx hardhat node

npx hardhat run zk-scripts/deploy.ts --network localhost

npx hardhat run zk-scripts/execute.ts --network localhost

cd frontend && npm run dev

npx tsx zk-scripts/generateRecoveryHashandProof.ts

voila you can do your recover from the frontend

deployments


8968f64328829f19e79c9 npx tsx zk-scripts/deploy.ts
🚀 Deploying ZK Smart Account Recovery to Linea Sepolia...
📝 Deployer address: 0x945dc407f256015329D5E38BE8367278a4ab072c
💰 Balance: 0.984836243792690801 ETH
🌐 Network: Linea Sepolia (Chain ID: 59141)
⛽ Gas price: 0.1342845 gwei

1️⃣ Using existing Poseidon2...
✅ Using Poseidon2 at: 0xb92036C1E795FA54b13E7679c805915b43c7F089

2️⃣ Deploying EntryPoint...
✅ EntryPoint deployed to: 0x501Fe10135Ad30BC6FD25Dbb63F54D98409a1DfC

3️⃣ Deploying HonkVerifier...
✅ HonkVerifier deployed to: 0xBf20D4bB442C725f9cBFA30Fb19633ae812A219F

4️⃣ Deploying SmartAccountFactory...
✅ SmartAccountFactory deployed to: 0x0Ffe1bf8dD812e111c20469C433a20903ACcc4a7

5️⃣ Deploying ERC20Mock...
✅ ERC20Mock deployed to: 0xf728e95F5aeEd3DA887ff82F48911BAE263BB0C5

📋 Deployment Summary:
======================

Network: Linea Sepolia
Chain ID: 59141
Deployer: 0x945dc407f256015329D5E38BE8367278a4ab072c
Poseidon2: 0xb92036C1E795FA54b13E7679c805915b43c7F089
HonkVerifier: 0xBf20D4bB442C725f9cBFA30Fb19633ae812A219F
EntryPoint: 0x501Fe10135Ad30BC6FD25Dbb63F54D98409a1DfC
SmartAccountFactory: 0x0Ffe1bf8dD812e111c20469C433a20903ACcc4a7
ERC20Mock: 0xf728e95F5aeEd3DA887ff82F48911BAE263BB0C5

🎉 Deployment completed successfully!
kaleab@Kaleabs-MacBook-Air daemon %
