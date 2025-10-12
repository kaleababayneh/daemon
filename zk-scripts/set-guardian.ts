import { network } from "hardhat";
const { viem } = await network.connect();

// Contract addresses for Linea testnet
const SMART_ACCOUNT_ADDRESS = "0x8beb6669E487FDb09CE67F581d427AaC01D3cb50";

async function main() {
    const [signer] = await viem.getWalletClients();
    console.log(`Setting guardian commitment with account: ${signer.account.address}`);

    // Get the smart account contract
    const smartAccount = await viem.getContractAt("SmartAccount", SMART_ACCOUNT_ADDRESS);

    // Guardian commitment from your previous tests
    // This is the Poseidon2 hash of secret_key=1, secret_answer="mango"
    const guardianCommitment = "0x2d496a0c2b4c3e68a41df8f74e7bc200cb1ee72b0d6d418c0b1677b38d93f3ac";

    console.log(`Setting guardian commitment: ${guardianCommitment}`);

    // Set the guardian commitment
    const tx = await smartAccount.write.setGuardian([guardianCommitment]);
    
    console.log(`Transaction hash: ${tx}`);
    
    // Wait for confirmation
    const publicClient = await viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    
    console.log(`✅ Guardian commitment set! Block: ${receipt.blockNumber}`);
    
    // Verify it was set correctly
    const storedCommitment = await smartAccount.read.getGuardianCommitments();
    console.log(`Stored guardian commitment: ${storedCommitment}`);
    
    if (storedCommitment === guardianCommitment) {
        console.log("🎉 Guardian commitment verified successfully!");
    } else {
        console.log("❌ Guardian commitment mismatch!");
    }
}

main().catch(console.error);