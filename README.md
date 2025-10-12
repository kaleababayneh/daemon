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