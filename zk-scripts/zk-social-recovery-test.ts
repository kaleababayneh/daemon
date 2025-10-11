import { network } from "hardhat";
const { viem } = await network.connect();
import { getCreateAddress } from "ethers";
import { encodeFunctionData } from "viem/utils";
import generateProof  from "./generateProof.js";

/**
 * ZK Social Recovery Test Script
 * This script demonstrates how to:
 * 1. Deploy contracts
 * 2. Create a smart account with ZK social recovery
 * 3. Set guardian commitments
 * 4. Perform account recovery using ZK proof
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
    const [signer0, signer1, guardian] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    console.log(`Account owner: ${signer0.account.address}`);
    console.log(`New owner: ${signer1.account.address}`);
    console.log(`Guardian: ${guardian.account.address}`);

    /**
     * 
     * 
     === DEPLOYMENT SUMMARY ===
    Poseidon2:           0x5fbdb2315678afecb367f032d93f642f64180aa3
    HonkVerifier:        0xe7f1725e7734ce288f8367e1bb143e90bb3f0512
    EntryPoint:          0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0
    SmartAccountFactory: 0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9
    Paymaster:           0xdc64a140aa3e981100a9beca4e685f962f0cf6c9
    ERC20Mock:           0x5fc8d32690cc91d4c39d9d3abcbd16989f875707
    ===========================
     */

    // Contract addresses from your deployment
    const HASHER_ADDR = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
    const VERIFIER_ADDR = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
    const FACTORY_ADDR = "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9";
    const ENTRYPOINT_ADDR = "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0";

    // Get contract instances
    const AccountFactory = await viem.getContractAt("SmartAccountFactory", FACTORY_ADDR);
    const Hasher = await viem.getContractAt("Poseidon2", HASHER_ADDR);
    const Verifier = await viem.getContractAt("HonkVerifier", VERIFIER_ADDR);

    // Create smart account with ZK social recovery
    console.log(`\n📱 Creating Smart Account...`);
    const createTx = await AccountFactory.write.createAccount([ENTRYPOINT_ADDR]);
    await publicClient.waitForTransactionReceipt({ hash: createTx });

    // Calculate account address (this depends on your factory's nonce)
    const accountAddress = getCreateAddress({
        from: FACTORY_ADDR,
        nonce: 1 // Adjust based on your factory's deployment nonce
    }) as `0x${string}`;

    const SmartAccount = await viem.getContractAt("SmartAccount", accountAddress);
    console.log(`✅ Smart Account created at: ${accountAddress}`);

    // Verify initial owner
    const initialOwner = await SmartAccount.read.owner();
    console.log(`Initial owner: ${initialOwner}`);

    // Set guardian commitments (example values - replace with real guardian commitments)
    console.log(`\n🛡️ Setting guardian commitments dynamically...`);
    
    // First generate a proof to get the computed commitment
    console.log("Computing guardian commitment...");
    const tempProofData = await generateProof(initialOwner, signer1.account.address);
    const computedCommitment = tempProofData.commitment;
    
    console.log(`✨ Computed guardian commitment: ${computedCommitment}`);
    
    /**
     * Dynamic commitment values using Fr-based Poseidon2 hashing:
     * Commitment: Poseidon2::hash([1, 2], 2) - computed dynamically
     * This ensures consistency between circuit and contract
     */
    
    // Actually set the guardian commitment on the contract
    console.log("Setting guardian commitment on contract...");
    
    // Since SmartAccount extends SocialRecovery, we can call setGuardian directly
    // But we need to use the owner to call it
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
        args: [computedCommitment as `0x${string}`]
    });
    
    // Call setGuardian as the owner
    const setGuardianTx = await signer0.sendTransaction({
        to: accountAddress,
        data: setGuardianData,
    });
    await publicClient.waitForTransactionReceipt({ hash: setGuardianTx });
    console.log(`✅ Guardian commitment set dynamically: ${computedCommitment}`);

    // Get guardian commitments to verify
    const commitments = await SmartAccount.read.getGuardianCommitments();
    console.log(`📋 Guardian commitments from contract:`, commitments);

    // Example ZK proof recovery (you would generate actual proof using your circuit)
    console.log(`\n🔐 Performing ZK Social Recovery...`);
    
    // Get current owner dynamically from the smart account
    const currentOwner = await SmartAccount.read.owner();
    const newOwner = signer1.account.address;
    
    console.log(`Current owner: ${currentOwner}`);
    console.log(`New owner: ${newOwner}`);
    
    const nonce = await SmartAccount.read.getNonce([currentOwner]);
    
    // Generate proof with dynamic owner values
    const zkProofReturned = await generateProof(currentOwner, newOwner);
    
    // Use the computed nullifier hash from the proof generation (dynamic)
    const nullifierHash = zkProofReturned.nullifierHash as `0x${string}`;

    // does the type ok

    const zkProof = `0x${uint8ArrayToHex(zkProofReturned.proof)}` as `0x${string}`;
    
    console.log(`Current nonce: ${nonce}`);
    console.log(`Nullifier hash zk recovery: ${nullifierHash}`);
    
    try {
        // Note: This will fail without a real ZK proof, but shows the interface
        const recoveryTx = await SmartAccount.write.recoverAccount([
            newOwner,
            nonce,
            nullifierHash,
            zkProof 
        ]);
        
        await publicClient.waitForTransactionReceipt({ hash: recoveryTx });
        
        // Verify ownership transfer
        const newOwnerAddr = await SmartAccount.read.owner();
        console.log(`\n✅ Account recovery successful!`);
        console.log(`Previous owner: ${initialOwner}`);
        console.log(`New owner: ${newOwnerAddr}`);
        
    } catch (error) {
        console.log(`\n⚠️ Recovery failed (expected without real ZK proof):`);
        console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`\n💡 To complete recovery, you need to:`);
        console.log(`1. Generate guardian commitment using: hash(secret_key, secret_answer_one)`);
        console.log(`2. Set guardian commitments on the contract`);
        console.log(`3. Generate ZK proof when recovery is needed`);
        console.log(`4. Call recoverAccount() with valid proof`);
    }

    console.log(`\n📊 Contract Status:`);
    console.log(`- Account Address: ${accountAddress}`);
    console.log(`- Current Owner: ${await SmartAccount.read.owner()}`);
    console.log(`- Guardian Count: ${await SmartAccount.read.guardianCount()}`);
    console.log(`- Account Balance: ${await publicClient.getBalance({ address: accountAddress })} ETH`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});