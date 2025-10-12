import { network } from "hardhat";
const { viem } = await network.connect();
import { getCreateAddress } from "ethers";
import { encodeFunctionData, hashMessage } from "viem/utils";

/**
Linea Sepolia Deployment Addresses:
Poseidon2:           0xb92036C1E795FA54b13E7679c805915b43c7F089
HonkVerifier:        0xBf20D4bB442C725f9cBFA30Fb19633ae812A219F
EntryPoint:          0x501Fe10135Ad30BC6FD25Dbb63F54D98409a1DfC
SmartAccountFactory: 0x0Ffe1bf8dD812e111c20469C433a20903ACcc4a7
ERC20Mock:           0xf728e95F5aeEd3DA887ff82F48911BAE263BB0C5
 */

const FACTORY_NONCE = 1;
const FACTORY_ADDR = "0x0Ffe1bf8dD812e111c20469C433a20903ACcc4a7"; // SmartAccountFactory
const EP_ADDR = "0x501Fe10135Ad30BC6FD25Dbb63F54D98409a1DfC";      // EntryPoint
const ERC20Mock_ADDR = "0xf728e95F5aeEd3DA887ff82F48911BAE263BB0C5"; // ERC20Mock

async function main() {
    const [signer0] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    const entryPoint = await viem.getContractAt("EntryPoint", EP_ADDR);
    const usdc = await viem.getContractAt("ERC20Mock", ERC20Mock_ADDR);
    
    // First, let's create a new smart account using the factory
    console.log("Creating new smart account...");
    const AccountFactory = await viem.getContractAt("SmartAccountFactory", FACTORY_ADDR);
    
    // Get the expected account address before creating it
    const expectedAddress = getCreateAddress({
        from: FACTORY_ADDR,
        nonce: FACTORY_NONCE
    });
    const sender = expectedAddress as `0x${string}`;
    console.log("Expected smart account address:", sender);

    // Check if account already exists
    const accountCode = await publicClient.getCode({ address: sender });
    
    if (!accountCode || accountCode === "0x") {
        console.log("Creating smart account...");
        const createTx = await AccountFactory.write.createAccount([EP_ADDR]);
        await publicClient.waitForTransactionReceipt({ hash: createTx });
        console.log("Smart account created at:", sender);
    } else {
        console.log("Smart account already exists at:", sender);
    }

    const Account = await viem.getContractAt("SmartAccount", sender);
    
    // Get the nonce for this account
    const nonce = await entryPoint.read.getNonce([sender, 0n]);
    console.log("Account nonce:", nonce);
    
    // Check current balance in EntryPoint
    const currentBalance = await entryPoint.read.balanceOf([sender]);
    console.log("Current EntryPoint balance:", currentBalance);
    
    // Fund the account if needed
    const requiredBalance = 10_000_000_000_000_000n; // 0.01 ETH (higher for Linea)
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