import { network } from "hardhat";
const { viem } = await network.connect();
import { encodeFunctionData } from "viem/utils";
import generateProof from "./scripts/generateProof.js";

/**
 * ZK Recovery Test with Your Specific Commitment
 * Testing recovery using your generated commitment: 0x2d496a0c2b4c3e68a41df8f74e7bc200cb1ee72b0d6d418c0b1677b38d93f3ac
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
    console.log("Testing ZK Recovery with your commitment...");
    
    const [signer0, signer1] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    console.log(`Current owner: ${signer0.account.address}`);
    console.log(`New owner: ${signer1.account.address}`);

    // Your commitment hash from generateCommitment.ts
    const yourCommitment = "0x2d496a0c2b4c3e68a41df8f74e7bc200cb1ee72b0d6d418c0b1677b38d93f3ac";
    
    // Use existing smart account address
    const smartAccountAddress = "0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81" as `0x${string}`;
    
    const SmartAccount = await viem.getContractAt("SmartAccount", smartAccountAddress);
    console.log(`✅ Using Smart Account at: ${smartAccountAddress}`);

    // Check current owner
    const currentOwner = await SmartAccount.read.owner();
    console.log(`Current owner: ${currentOwner}`);
    
    // Check if your guardian commitment is set
    const commitments = await SmartAccount.read.getGuardianCommitments();
    console.log(`Guardian commitments from contract:`, commitments);
    
    // Check if commitments is an array and has your commitment
    const commitmentsArray = Array.isArray(commitments) ? commitments : [commitments];
    const hasYourCommitment = commitmentsArray.some((c: any) => c.toLowerCase() === yourCommitment.toLowerCase());
    
    if (!hasYourCommitment) {
        console.log("⚠️ Your commitment not found. Setting it now...");
        
        const setGuardianData = encodeFunctionData({
            abi: [
                {
                    "inputs": [{"internalType": "bytes32", "name": "_guardian", "type": "bytes32"}],
                    "name": "setGuardian",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ],
            functionName: "setGuardian",
            args: [yourCommitment as `0x${string}`]
        });
        
        const setGuardianTx = await signer0.sendTransaction({
            to: smartAccountAddress,
            data: setGuardianData,
        });
        await publicClient.waitForTransactionReceipt({ hash: setGuardianTx });
        console.log(`✅ Your commitment set: ${yourCommitment}`);
    } else {
        console.log(`✅ Your commitment is already set: ${yourCommitment}`);
    }

    // Generate ZK proof for recovery
    console.log("\n🔐 Generating ZK proof for recovery...");
    
    const nonce = await SmartAccount.read.getNonce([currentOwner]);
    console.log(`Current nonce: ${nonce}`);
    
    // Generate proof using the hardcoded values in the function
    // Note: The generateProof function uses hardcoded values that should match your commitment
    const zkProofReturned = await generateProof();
    
    console.log(`Generated proof length: ${zkProofReturned.proof.length}`);
    console.log(`Public inputs: ${zkProofReturned.publicInputs}`);
    
    // Extract commitment and nullifier from public inputs
    // Based on the circuit, public inputs are [nullifier_hash, commitment, new_owner, current_owner]
    const nullifierHash = zkProofReturned.publicInputs[0]; // First public input is nullifier_hash
    const commitment = zkProofReturned.publicInputs[1];    // Second public input is commitment
    
    console.log(`Generated commitment: ${commitment}`);
    console.log(`Your commitment: ${yourCommitment}`);
    
    if (commitment.toLowerCase() !== yourCommitment.toLowerCase()) {
        console.log("⚠️ WARNING: Generated commitment doesn't match your commitment!");
        console.log("Make sure the generateProof function uses the same secret_key and answer values.");
        console.log("This will likely cause the proof verification to fail.");
    } else {
        console.log("✅ Commitments match! Proceeding with recovery...");
    }
    
    const zkProof = `0x${uint8ArrayToHex(zkProofReturned.proof)}` as `0x${string}`;
    
    console.log(`Nullifier hash: ${nullifierHash}`);
    console.log(`Proof length: ${zkProof.length} characters`);
    
    try {
        console.log("\n🚀 Attempting account recovery...");
        const recoveryTx = await SmartAccount.write.recoverAccount([
            signer1.account.address,
            nonce,
            nullifierHash as `0x${string}`,
            zkProof 
        ]);
        
        await publicClient.waitForTransactionReceipt({ hash: recoveryTx });
        
        // Verify ownership transfer
        const newOwnerAddr = await SmartAccount.read.owner();
        console.log(`\n✅ Account recovery successful!`);
        console.log(`Previous owner: ${currentOwner}`);
        console.log(`New owner: ${newOwnerAddr}`);
        
    } catch (error: any) {
        console.log(`\n❌ Recovery failed:`);
        console.log(`Error: ${error.message}`);
        
        if (error.message.includes("Internal error")) {
            console.log("\n🔍 Debugging tips:");
            console.log("1. Ensure the generateProof function uses the same secret_key and answer from generateCommitment.ts");
            console.log("2. The commitment generated during proof must match the guardian commitment");
            console.log("3. Check that the ZK circuit is correctly computing the hash");
            console.log(`4. Your commitment should be: ${yourCommitment}`);
            console.log(`5. Generated commitment was: ${commitment}`);
            console.log("6. Update the generateProof function to use your specific secret values");
        }
    }

    console.log(`\n📊 Final Contract Status:`);
    console.log(`- Account Address: ${smartAccountAddress}`);
    console.log(`- Current Owner: ${await SmartAccount.read.owner()}`);
    console.log(`- Guardian Count: ${await SmartAccount.read.guardianCount()}`);
}

main().catch(console.error);