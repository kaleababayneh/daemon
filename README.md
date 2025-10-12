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

Deploying contracts with account: 0x945dc407f256015329d5e38be8367278a4ab072c
Poseidon2 deployed to 0xfbca54f1ea66bdbec1bda7f70071bd44e4d23247
HonkVerifier deployed to 0xb80e7cd9364752484578b23c8e6e86a80774451c
EntryPoint deployed to 0x470d5588fd69f3d4eb4d82f950d483a7be9131a4
SmartAccountFactory deployed to 0xc729bbd894d27a8330eb91bb41d7965fac3ce33a
Paymaster deployed to 0xf4f78729200929ec8610f4352fdbeb450393d8e0
ERC20Mock deployed to 0xc0265d051d8a15f94a33cb90256b7c5a02bc0579

 DEPLOYMENT SUMMARY 
Poseidon2:           0xfbca54f1ea66bdbec1bda7f70071bd44e4d23247
HonkVerifier:        0xb80e7cd9364752484578b23c8e6e86a80774451c
EntryPoint:          0x470d5588fd69f3d4eb4d82f950d483a7be9131a4
SmartAccountFactory: 0xc729bbd894d27a8330eb91bb41d7965fac3ce33a
Paymaster:           0xf4f78729200929ec8610f4352fdbeb450393d8e0
ERC20Mock:           0xc0265d051d8a15f94a33cb90256b7c5a02bc0579