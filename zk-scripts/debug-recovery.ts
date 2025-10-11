import { network } from "hardhat";
const { viem } = await network.connect();

async function debugRecovery() {
    const [signer0, signer1] = await viem.getWalletClients();
    
    // Your contract address
    const accountAddress = "0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81" as `0x${string}`;
    const SmartAccount = await viem.getContractAt("SmartAccount", accountAddress);
    
    // Check current state
    const owner = await SmartAccount.read.owner();
    const guardianCount = await SmartAccount.read.guardianCount();
    const commitments = await SmartAccount.read.getGuardianCommitments();
    
    console.log("=== CONTRACT STATE ===");
    console.log("Current owner:", owner);
    console.log("Guardian count:", guardianCount.toString());
    console.log("Guardian commitments:", commitments);
    
    // Check what your circuit expects vs what you're sending
    const nullifierHash = "0x2cd4d71448af6e33f360c4413015a6c5029ec64d4caaaee246602769d1760eaa";
    const guardianCommitment = "0x01ed2748ac88efdb33f8b6ebf525601961ced4ee001e0f21577178d7b368bc8f";
    const newOwner = signer1.account.address;
    const currentOwner = owner;
    
    console.log("\n=== PUBLIC INPUTS ===");
    console.log("nullifier_hash:", nullifierHash);
    console.log("guardians_commitment:", guardianCommitment);
    console.log("new_owner:", newOwner);
    console.log("current_owner:", currentOwner);
    
    // Check if guardian commitment matches
    if (commitments.length > 0) {
        console.log("\n=== GUARDIAN VERIFICATION ===");
        console.log("Expected commitment:", guardianCommitment);
        console.log("Actual commitment:", commitments[0]);
        console.log("Match:", commitments[0] === guardianCommitment);
    }
}

debugRecovery().catch(console.error);