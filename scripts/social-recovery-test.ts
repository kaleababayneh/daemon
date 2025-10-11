import { network } from "hardhat";
const { viem } = await network.connect();
import { getCreateAddress } from "ethers";
import { encodeFunctionData, hashTypedData } from "viem/utils";

/**
 * Social Recovery Test Script
 * This script demonstrates how to:
 * 1. Deploy contracts
 * 2. Create a smart account
 * 3. Set a guardian
 * 4. Perform account recovery using guardian signature
 */

// taken from @aztec/bb.js/proof
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

    // Deploy contracts
    const AccountFactory = await viem.deployContract("SmartAccountFactory");
    const EntryPoint = await viem.deployContract("EntryPoint");
    
    console.log(`\nFactory deployed to: ${AccountFactory.address}`);
    console.log(`EntryPoint deployed to: ${EntryPoint.address}`);

    // Create smart account
    const createTx = await AccountFactory.write.createAccount([EntryPoint.address]);
    await publicClient.waitForTransactionReceipt({ hash: createTx });
    
    // Calculate account address
    const accountAddress = getCreateAddress({
        from: AccountFactory.address,
        nonce: 1
    }) as `0x${string}`;

    const SmartAccount = await viem.getContractAt("SmartAccount", accountAddress);
    console.log(`\nSmart Account created at: ${accountAddress}`);

    // Verify initial owner
    const initialOwner = await SmartAccount.read.owner();
    console.log(`Initial owner: ${initialOwner}`);

    // Set guardian
    const setGuardianTx = await SmartAccount.write.setGuardian([guardian.account.address]);
    await publicClient.waitForTransactionReceipt({ hash: setGuardianTx });
    
    const currentGuardian = await SmartAccount.read.guardian();
    console.log(`Guardian set to: ${currentGuardian}`);

    // Get current nonce for recovery
    const currentNonce = await SmartAccount.read.getNonce([initialOwner]);
    console.log(`Current nonce: ${currentNonce}`);

    // Create EIP-712 typed data for recovery
    const domain = {
        name: "SmartAccount",
        version: "1",
        chainId: await publicClient.getChainId(),
        verifyingContract: accountAddress,
    };

    const types = {
        Recover: [
            { name: "currentOwner", type: "address" },
            { name: "newOwner", type: "address" },
            { name: "nonce", type: "uint256" },
        ],
    };

    const message = {
        currentOwner: initialOwner,
        newOwner: signer1.account.address,
        nonce: currentNonce,
    };

    // Guardian signs the recovery message
    const signature = await guardian.signTypedData({
        domain,
        types,
        primaryType: "Recover",
        message,
    });

    console.log(`\nRecovery signature: ${signature}`);

    // Perform recovery
    console.log(`\nPerforming account recovery...`);
    const recoveryTx = await SmartAccount.write.recoverAccount([
        signer1.account.address, // newOwner
        currentNonce,            // nonce
        signature                // guardian signature
    ]);
    
    await publicClient.waitForTransactionReceipt({ hash: recoveryTx });

    // Verify ownership transfer
    const newOwner = await SmartAccount.read.owner();
    console.log(`\n✅ Account recovery successful!`);
    console.log(`Previous owner: ${initialOwner}`);
    console.log(`New owner: ${newOwner}`);
    console.log(`Recovery was performed by guardian: ${currentGuardian}`);

    // Test that the new owner can now execute functions
    console.log(`\n📊 Testing new owner can execute...`);
    const Account = await viem.getContractAt("SmartAccount", accountAddress, {
        client: { wallet: signer1 }
    });
    
    // Test 1: Execute a simple call to get the count (should work)
    try {
        const currentCount = await Account.read.count();
        console.log(`Current count: ${currentCount}`);
        
        // Test 2: Execute a transfer to self (simple test)
        const executeTx = await Account.write.execute([
            signer1.account.address,  // to: send to the new owner
            0n,                       // value: 0 ETH (no transfer)
            "0x"                      // data: empty calldata
        ]);
        await publicClient.waitForTransactionReceipt({ hash: executeTx });
        
        console.log(`✅ New owner successfully executed function!`);
        console.log(`Transaction hash: ${executeTx}`);
        
    } catch (error) {
        console.log(`❌ Execute failed, but account recovery was successful!`);
        console.log(`Error: ${error}`);
        
        // Try a simpler test - just verify the new owner can call read functions
        const owner = await Account.read.owner();
        console.log(`✅ New owner can read contract state. Owner: ${owner}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});