import { network } from "hardhat";
const { viem } = await network.connect();
import generateProof from "./scripts/generateProof.js";

/**
 * Guardian Recovery Data Generator
 * This script helps guardians generate recovery data for account owners
 * Usage: npx hardhat run guardian-generate-recovery.ts --network localhost
 */

export function uint8ArrayToHex(buffer: Uint8Array): string {
  const hex: string[] = [];
  buffer.forEach(function (i) {
    let h = i.toString(16);
    if (h.length % 2) {
      h = "0" + h;
    }
    hex.push(h);
  });
  return hex.join("");
}

async function main() {
    console.log("🛡️  Guardian Recovery Data Generator");
    console.log("=====================================");
    console.log("");
    
    const [signer0, signer1] = await viem.getWalletClients();
    
    // Use the specific new owner address
    const newOwnerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    
    console.log("📋 Current Configuration:");
    console.log(`   Current Owner: ${signer0.account.address}`);
    console.log(`   New Owner: ${newOwnerAddress}`);
    console.log("");
    console.log("🔐 Generating ZK recovery proof...");
    console.log("⏳ This may take a moment...");
    
    try {
        // Generate proof using the guardian's secrets
        const zkProofReturned = await generateProof();
        
        console.log("✅ Proof generated successfully!");
        console.log("");
        
        // Extract data from proof
        const nullifierHash = zkProofReturned.publicInputs[0]; // First public input is nullifier_hash
        const commitment = zkProofReturned.publicInputs[1];    // Second public input is commitment
        const zkProof = `0x${uint8ArrayToHex(zkProofReturned.proof)}`;
        
        // Create recovery package
        const recoveryPackage = {
            nullifier_hash: nullifierHash,
            zk_proof: zkProof,
            new_owner: newOwnerAddress,
            current_owner: signer0.account.address,
            commitment: commitment,
            generated_at: new Date().toISOString(),
            proof_length: zkProof.length,
            instructions: "Copy this entire JSON object and paste it into the recovery form on the frontend"
        };
        
        console.log("📦 Recovery Package Generated:");
        console.log("==============================");
        console.log(JSON.stringify(recoveryPackage, null, 2));
        console.log("==============================");
        console.log("");
        console.log("📋 INSTRUCTIONS FOR ACCOUNT OWNER:");
        console.log("1. Copy the entire JSON object above");
        console.log("2. Go to the frontend recovery page");
        console.log("3. Paste it in the 'Recovery Data' textarea");
        console.log("4. Click 'Parse Recovery Data'");
        console.log("5. Click 'Execute ZK Recovery'");
        console.log("");
        console.log("🔒 SECURITY NOTE:");
        console.log("- This proof can only be used once");
        console.log("- Share it securely with the account owner");
        console.log("- Delete this data after successful recovery");
        
    } catch (error: any) {
        console.error("❌ Error generating recovery data:", error.message);
        console.error("");
        console.error("🔍 Troubleshooting:");
        console.error("1. Ensure you're using the same secret values as the commitment");
        console.error("2. Check that the blockchain is running");
        console.error("3. Verify the smart account exists");
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exitCode = 1;
});