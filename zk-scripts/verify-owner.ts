import { network } from "hardhat";
const { viem } = await network.connect();

async function main() {
    const [signer0, signer1] = await viem.getWalletClients();
    
    // The account address from your log
    const accountAddress = "0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81";
    
    console.log(`Checking ownership of account: ${accountAddress}`);
    console.log(`Expected original owner: ${signer0.account.address}`);
    console.log(`Expected new owner: ${signer1.account.address}`);
    
    try {
        const SmartAccount = await viem.getContractAt("SmartAccount", accountAddress);
        const currentOwner = await SmartAccount.read.owner();
        
        console.log(`\n📊 OWNERSHIP STATUS:`);
        console.log(`Current owner: ${currentOwner}`);
        
        if (currentOwner.toLowerCase() === signer1.account.address.toLowerCase()) {
            console.log(`✅ SUCCESS! Ownership transferred to new owner (signer1)`);
            console.log(`🎉 ZK Social Recovery completed successfully!`);
        } else if (currentOwner.toLowerCase() === signer0.account.address.toLowerCase()) {
            console.log(`❌ Ownership still with original owner (signer0)`);
            console.log(`💡 Recovery may have failed or not been executed`);
        } else {
            console.log(`⚠️ Unexpected owner: ${currentOwner}`);
        }
        
        // Check other contract state
        const guardianCount = await SmartAccount.read.guardianCount();
        const nonce = await SmartAccount.read.getNonce([signer0.account.address]);
        
        console.log(`\n📋 CONTRACT STATE:`);
        console.log(`Guardian count: ${guardianCount}`);
        console.log(`Current nonce: ${nonce}`);
        
    } catch (error) {
        console.error(`Error checking account: ${error}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});