Privacy Preserving Smart Account Recovery


proof generation commands


nargo compile

bb write_vk --oracle_hash keccak -b ./target/circuits.json -o ./target

bb write_solidity_verifier -k ./target/vk -o ./target/Verifier.sol


deploy contracts

npx hardhat run scripts/deploy.ts --network localhost