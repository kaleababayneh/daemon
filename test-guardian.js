const { ethers } = require('hardhat');

async function main() {
    const [signer] = await ethers.getSigners();
    console.log('Using signer:', signer.address);
    
    const smartAccountAddress = '0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81';
    
    // Get the smart account contract
    const SmartAccount = await ethers.getContractAt('SmartAccount', smartAccountAddress);
    
    // Check current owner
    const owner = await SmartAccount.owner();
    console.log('Smart account owner:', owner);
    
    // Check current guardian commitment
    const currentCommitment = await SmartAccount.getGuardianCommitments();
    console.log('Current guardian commitment:', currentCommitment);
    
    // Set a test guardian commitment
    const testCommitment = '0x038682aa1cb5ae4e0a3f13da432a95c77c5c111f6f030faf9cad641ce1ed7383';
    console.log('Setting guardian commitment to:', testCommitment);
    
    try {
        const tx = await SmartAccount.setGuardian(testCommitment);
        console.log('Transaction hash:', tx.hash);
        
        const receipt = await tx.wait();
        console.log('Transaction confirmed in block:', receipt.blockNumber);
        
        // Check the new commitment
        const newCommitment = await SmartAccount.getGuardianCommitments();
        console.log('New guardian commitment:', newCommitment);
        
    } catch (error) {
        console.error('Error setting guardian:', error.message);
    }
}

main().catch(console.error);