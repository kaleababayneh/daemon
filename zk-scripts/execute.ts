import { network } from "hardhat";
const { viem } = await network.connect();
import { getCreateAddress } from "ethers";
import { encodeFunctionData, hashMessage } from "viem/utils";

/**
Base Sepolia Deployment Addresses:
Poseidon2:           0xc0265D051d8a15F94a33CB90256B7C5A02bc0579
HonkVerifier:        0xcc716b91e473fCA3f8067da29107E23d7D284A70
EntryPoint:          0x5987e074c2B22CC2BEdb18A59E36467600cD1549
SmartAccountFactory: 0x4d25cBbDb71F1bc34D20A421909D399215b99416
Demo SmartAccount:   0xc2716d0E52EfDa2Ae79b8e45Cb15C55cA119F7d3
ERC20Mock:           0x4d9B95e1a074414CBd09cf44BB5daEBBeBEc096f
 */

const FACTORY_NONCE = 1;
const FACTORY_ADDR = "0x4d25cBbDb71F1bc34D20A421909D399215b99416"; // SmartAccountFactory
const EP_ADDR = "0x5987e074c2B22CC2BEdb18A59E36467600cD1549";      // EntryPoint
const DEMO_ACCOUNT_ADDR = "0xc2716d0E52EfDa2Ae79b8e45Cb15C55cA119F7d3"; // Demo SmartAccount
const ERC20Mock_ADDR = "0x4d9B95e1a074414CBd09cf44BB5daEBBeBEc096f"; // ERC20Mock

async function main() {
    const [signer0] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    const entryPoint = await viem.getContractAt("EntryPoint", EP_ADDR);
    const usdc = await viem.getContractAt("ERC20Mock", ERC20Mock_ADDR);
    
    // Use the demo smart account that was already created during deployment
    const sender = DEMO_ACCOUNT_ADDR as `0x${string}`;

    const nonce = await entryPoint.read.getNonce([sender, 0n]);

    const accountCode = await publicClient.getCode({ address: sender });

    if (!accountCode || accountCode === "0x") {
        console.log("Smart account not found at expected address. Using factory to create one...");
        const AccountFactory = await viem.getContractAt("SmartAccountFactory", FACTORY_ADDR);
        const createTx = await AccountFactory.write.createAccount([EP_ADDR]);
        await publicClient.waitForTransactionReceipt({ hash: createTx });
        console.log("Account created!");
    } else {
        console.log("Smart account found at:", sender);
    }

    const Account = await viem.getContractAt("SmartAccount", sender);
    
    // Check current balance in EntryPoint
    const currentBalance = await entryPoint.read.balanceOf([sender]);
    console.log("Current EntryPoint balance:", currentBalance);
    
    // Fund the account if needed
    const requiredBalance = 1_000_000_000_000_000n; // 0.001 ETH
    if (currentBalance < requiredBalance) {
        console.log("Funding account...");
        await entryPoint.write.depositTo([sender], { 
            value: requiredBalance 
        });
        console.log("Account funded with:", requiredBalance);
    }
    
    // Fix 1: Mint tokens TO the smart account, not to the ERC20Mock contract
    let value = 1_000_000_000_000_000n;
    const mintCalldata = encodeFunctionData({
        abi: usdc.abi,
        functionName: "mint",
        args: [sender, value] // Mint TO the smart account address
    });

    // Fix 2: Call mint on the ERC20Mock contract, send 0 ETH value
    const callData = encodeFunctionData({
        abi: Account.abi,
        functionName: "execute",
        args: [
            ERC20Mock_ADDR, // Target: ERC20Mock contract
            0n,             // Value: 0 ETH (we're not sending ETH)
            mintCalldata    // Data: mint function call
        ]
    });

    const userOp = {
        sender,
        nonce,
        initCode: "0x" as `0x${string}`, 
        callData,
        accountGasLimits: "0x000000000000000000000000000186a0000000000000000000000000000186a0" as `0x${string}`,
        preVerificationGas: 50000n, 
        gasFees: "0x0000000000000000000000000100000000000000000000000000000000000100" as `0x${string}`, // Higher gas fees
        paymasterAndData: "0x" as `0x${string}`,
        signature: "0x" as `0x${string}`,
    };

    const userOpHash = await entryPoint.read.getUserOpHash([userOp]);
    console.log("UserOpHash:", userOpHash);
        
    const signature = await signer0.signMessage({ 
        message: { raw: userOpHash }
    });
    
    userOp.signature = signature;

    console.log("Executing UserOp:", userOp);
    
    const txHash = await entryPoint.write.handleOps([[userOp], signer0.account.address]);
    console.log("Transaction hash:", txHash);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log("Success! Block:", receipt.blockNumber);

    console.log("Verifying balance...");
    const bal = await usdc.read.balanceOf([sender]);
    console.log("USDC Balance:", bal);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});