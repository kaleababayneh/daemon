Privacy Preserving Social Account Recovery


proof generation commands


nargo compile

bb write_vk --oracle_hash keccak -b ./target/circuits.json -o ./target

bb write_solidity_verifier -k ./target/vk -o ./target/Verifier.sol


deploy contracts

npx hardhat run scripts/deploy.ts --network localhost

// frontend set up
 npx hardhat node  
./get-account-address.sh
page.tsx const SMART_ACCOUNT_ADDRESS = 'YOUR_DEPLOYED_ADDRESS'
npm run dev