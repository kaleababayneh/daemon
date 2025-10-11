import { network } from "hardhat";
const { viem } = await network.connect();

async function main() {
    const [signer] = await viem.getWalletClients();
    console.log('Using signer:', signer.account.address);
    
    const smartAccountAddress = '0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81' as `0x${string}`;
    
    // Get the smart account contract
    const SmartAccount = await viem.getContractAt('SmartAccount', smartAccountAddress);
    
    // Check current owner
    const owner = await SmartAccount.read.owner();
    console.log('Smart account owner:', owner);
    
    // Check current guardian commitment
    const currentCommitment = await SmartAccount.read.getGuardianCommitments();
    console.log('Current guardian commitment:', currentCommitment);
    
    // Set a test guardian commitment
    const testCommitment = '0x038682aa1cb5ae4e0a3f13da432a95c77c5c111f6f030faf9cad641ce1ed7383' as `0x${string}`;
    console.log('Setting guardian commitment to:', testCommitment);
    
    try {
        const tx = await SmartAccount.write.setGuardian([testCommitment]);
        console.log('Transaction hash:', tx);
        
        const publicClient = await viem.getPublicClient();
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log('Transaction confirmed in block:', receipt.blockNumber);
        
        // Check the new commitment
        const newCommitment = await SmartAccount.read.getGuardianCommitments();
        console.log('New guardian commitment:', newCommitment);
        
    } catch (error: any) {
        console.error('Error setting guardian:', error.message);
    }
}

main().catch(console.error);