import { network } from "hardhat";
const { viem } = await network.connect();

async function debugContractValues() {
    const [signer0, signer1] = await viem.getWalletClients();
    const accountAddress = "0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81" as `0x${string}`;
    const SmartAccount = await viem.getContractAt("SmartAccount", accountAddress);
    
    // These are the HARDCODED values in your contract
    const hardcodedCurrentOwner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const hardcodedNewOwner = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const nullifierHash = "0x2cd4d71448af6e33f360c4413015a6c5029ec64d4caaaee246602769d1760eaa";
    const guardianCommitment = await SmartAccount.read.getGuardianCommitments();
    
    console.log("=== CONTRACT HARDCODED VALUES ===");
    console.log("Hardcoded currentOwner:", hardcodedCurrentOwner);
    console.log("Hardcoded newOwner:", hardcodedNewOwner);
    console.log("Guardian commitment:", guardianCommitment);
    console.log("Nullifier hash:", nullifierHash);
    
    // Convert exactly like your contract does
    const convertedCurrentOwner = `0x${BigInt(hardcodedCurrentOwner).toString(16).padStart(64, '0')}`;
    const convertedNewOwner = `0x${BigInt(hardcodedNewOwner).toString(16).padStart(64, '0')}`;
    
    console.log("\n=== CONVERTED VALUES (as contract sends to verifier) ===");
    console.log("publicInputs[0] (nullifierHash):", nullifierHash);
    console.log("publicInputs[1] (guardianCommitment):", guardianCommitment);
    console.log("publicInputs[2] (newOwner converted):", convertedNewOwner);
    console.log("publicInputs[3] (currentOwner converted):", convertedCurrentOwner);
    
    console.log("\n=== YOUR PROOF GENERATION SHOULD USE EXACTLY THESE VALUES ===");
}

debugContractValues().catch(console.error);